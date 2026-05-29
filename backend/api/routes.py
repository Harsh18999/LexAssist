import asyncio
import json
import os
import tempfile

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

DEFAULT_PAGE_SIZE = 10
MAX_PAGE_SIZE = 100


def _paginate(items: list, page: int, page_size: int) -> dict:
    """Slice a list and return pagination envelope."""
    page = max(1, page)
    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    total = len(items)
    total_pages = max(1, -(-total // page_size))  # ceiling division
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }

from backend.api.deps import get_current_user
from backend.services import (
    activity_service,
    case_service,
    chat_service,
    client_service,
    dashboard_service,
    document_service,
    hearing_service,
    note_service,
    workspace_service,
)
from backend.services import insights_service, thread_service
from backend.utils import s3_storage

router = APIRouter()


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    query: str


# Valid chat modes
VALID_MODES = {"MAIN", "BNS", "BNSS", "BSA", "CNT", "IT", "CASE"}


class ThreadChatRequest(BaseModel):
    query: str
    thread_id: str
    mode: str = "MAIN"   # "MAIN" | "BNS" | "BNSS" | "BSA" | "CNT" | "IT"
    case_id: str | None = None


class ThreadCreateRequest(BaseModel):
    mode: str = "MAIN"
    title: str = "New Conversation"
    case_id: str | None = None


class ThreadRenameRequest(BaseModel):
    title: str


class ClientRequest(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    advocate: str = ""
    jurisdiction: str = ""


class ClientUpdateRequest(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    advocate: str | None = None
    jurisdiction: str | None = None


class CaseRequest(BaseModel):
    client_id: str
    title: str
    case_number: str = ""
    court: str = ""
    filing_date: str = ""
    judgment_date: str = ""
    case_type: str = ""
    petitioner: str = ""
    respondent: str = ""
    judges: str = ""
    status: str = "Active"
    acts_involved: str = ""
    constitutional_articles: str = ""
    hearing_date: str = ""
    advocate: str = ""


class NoteRequest(BaseModel):
    content: str


class HearingRequest(BaseModel):
    event_date: str
    event_type: str = "hearing"
    court: str = ""
    description: str = ""


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

@router.get("/dashboard")
def dashboard(user=Depends(get_current_user)):
    return dashboard_service.get_dashboard(user["id"])


@router.get("/dashboard/stream")
def dashboard_stream(user=Depends(get_current_user)):
    """SSE endpoint — pushes dashboard payload as a single 'data' event."""
    def _gen():
        data = dashboard_service.get_dashboard(user["id"])
        yield f"data: {json.dumps(data)}\n\n"
    return StreamingResponse(
        _gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/me")
def me(user=Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

@router.get("/clients")
def clients(
    search: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    response: Response = None,
    user=Depends(get_current_user),
):
    all_items = client_service.list_clients(user["id"], search)
    result = _paginate(all_items, page, page_size)
    if response:
        response.headers["X-Total-Count"] = str(result["total"])
    return {"clients": result["items"], **{k: result[k] for k in ("total", "page", "page_size", "total_pages")}}


@router.post("/clients")
def create_client(req: ClientRequest, user=Depends(get_current_user)):
    c = client_service.create_client(user["id"], req.model_dump())
    activity_service.log_activity(user["id"], "Client Created", c["name"])
    return c


@router.get("/clients/{client_id}")
def get_client(client_id: str, user=Depends(get_current_user)):
    c = client_service.get_client(user["id"], client_id)
    if not c:
        raise HTTPException(404, "Client not found")
    c["cases"] = case_service.list_cases(user["id"], client_id=client_id)
    c["documents"] = workspace_service.list_user_documents(user["id"])
    return c


@router.patch("/clients/{client_id}")
def update_client(client_id: str, req: ClientUpdateRequest, user=Depends(get_current_user)):
    """Partial update for a client record."""
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "No fields provided to update")
    c = client_service.update_client(user["id"], client_id, data)
    if not c:
        raise HTTPException(404, "Client not found")
    activity_service.log_activity(user["id"], "Client Updated", c["name"])
    return c


@router.delete("/clients/{client_id}")
def delete_client(
    client_id: str,
    force: bool = Query(False, description="Cascade-delete all related cases"),
    user=Depends(get_current_user),
):
    """Delete a client. Use force=true to also delete all their cases."""
    try:
        deleted = client_service.delete_client(user["id"], client_id, force=force)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if not deleted:
        raise HTTPException(404, "Client not found")
    activity_service.log_activity(user["id"], "Client Deleted", client_id)
    return {"ok": True, "deleted": client_id}


# ---------------------------------------------------------------------------
# Cases
# ---------------------------------------------------------------------------

@router.get("/cases")
def cases(
    search: str = "",
    client_id: str = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    response: Response = None,
    user=Depends(get_current_user),
):
    all_items = case_service.list_cases(user["id"], search, client_id)
    result = _paginate(all_items, page, page_size)
    if response:
        response.headers["X-Total-Count"] = str(result["total"])
    return {"cases": result["items"], **{k: result[k] for k in ("total", "page", "page_size", "total_pages")}}


@router.post("/cases")
def create_case(req: CaseRequest, user=Depends(get_current_user)):
    case = case_service.create_case(user["id"], req.model_dump())
    activity_service.log_activity(user["id"], "Case Created", case["title"])
    return case


@router.get("/cases/{case_id}")
def get_case(case_id: str, user=Depends(get_current_user)):
    case = case_service.get_case(user["id"], case_id)
    if not case:
        raise HTTPException(404, "Case not found")
    case["documents"] = workspace_service.list_case_documents(user["id"], case_id)
    case["notes"] = note_service.list_notes(user["id"], case_id)
    case["timeline"] = hearing_service.list_timeline(user["id"], case_id)
    return case


@router.patch("/cases/{case_id}")
def update_case(case_id: str, req: CaseRequest, user=Depends(get_current_user)):
    data = {k: v for k, v in req.model_dump().items() if v is not None and v != ""}
    case = case_service.update_case(user["id"], case_id, data)
    if not case:
        raise HTTPException(404, "Case not found")
    activity_service.log_activity(user["id"], "Case Updated", case["title"])
    return case


@router.delete("/cases/{case_id}")
def delete_case(case_id: str, user=Depends(get_current_user)):
    """Delete a case and its notes/timeline."""
    deleted = case_service.delete_case(user["id"], case_id)
    if not deleted:
        raise HTTPException(404, "Case not found")
    activity_service.log_activity(user["id"], "Case Deleted", case_id)
    return {"ok": True, "deleted": case_id}


# ---------------------------------------------------------------------------
# Documents — Upload, Download, Delete
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload a standalone PDF to S3 Documents/ folder."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed.")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file.")
    try:
        doc = workspace_service.save_document(user["id"], file.filename, content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    activity_service.log_activity(user["id"], "Document Uploaded", file.filename)
    return doc


@router.post("/cases/{case_id}/documents")
async def upload_case_doc(
    case_id: str, file: UploadFile = File(...), user=Depends(get_current_user)
):
    """Upload a PDF document for a specific case."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are allowed.")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file.")
    try:
        doc = workspace_service.save_case_document(user["id"], case_id, file.filename, content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    activity_service.log_activity(user["id"], "Case Document Uploaded", file.filename)
    return doc


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, user=Depends(get_current_user)):
    """Delete a document from S3 and the database."""
    deleted = workspace_service.delete_document(user["id"], doc_id)
    if not deleted:
        raise HTTPException(404, "Document not found.")
    activity_service.log_activity(user["id"], "Document Deleted", doc_id)
    return {"ok": True, "deleted": doc_id}


@router.get("/documents/{doc_id}/download")
def download_document(doc_id: str, user=Depends(get_current_user)):
    """Return a presigned S3 URL (valid 1 hour)."""
    url = workspace_service.get_document_download_url(user["id"], doc_id)
    if not url:
        raise HTTPException(404, "Document not found or no S3 key.")
    return {"url": url}


@router.get("/documents")
def list_documents(
    search: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    response: Response = None,
    user=Depends(get_current_user),
):
    """List all uploaded documents for the current user, paginated."""
    all_items = workspace_service.list_user_documents(user["id"], search)
    result = _paginate(all_items, page, page_size)
    if response:
        response.headers["X-Total-Count"] = str(result["total"])
    return {"documents": result["items"], **{k: result[k] for k in ("total", "page", "page_size", "total_pages")}}


# ---------------------------------------------------------------------------
# Thread management
# ---------------------------------------------------------------------------

@router.get("/threads")
def list_threads(
    mode: str | None = Query(None),
    case_id: str | None = Query(None),
    user=Depends(get_current_user),
):
    """List all threads for the current user, optionally filtered by mode/case."""
    threads = thread_service.list_threads(user["id"], mode, case_id)
    return {"threads": threads}


@router.post("/threads")
def create_thread(req: ThreadCreateRequest, user=Depends(get_current_user)):
    """Create a new chat thread."""
    if req.mode not in VALID_MODES:
        raise HTTPException(400, f"mode must be one of: {', '.join(sorted(VALID_MODES))}")
    t = thread_service.create_thread(user["id"], req.mode, req.title, req.case_id)
    activity_service.log_activity(user["id"], "Thread Created", req.title)
    return t


@router.get("/threads/default")
def get_default_thread(
    mode: str = Query("MAIN"),
    case_id: str | None = Query(None),
    user=Depends(get_current_user),
):
    """
    Return the most-recently-updated thread, or auto-create one.
    Used by the frontend to get/create a thread on first open.
    """
    t = thread_service.get_or_create_default_thread(user["id"], mode, case_id)
    return t


@router.get("/threads/{thread_id}")
def get_thread(thread_id: str, user=Depends(get_current_user)):
    """Get a single thread."""
    t = thread_service.get_thread(user["id"], thread_id)
    if not t:
        raise HTTPException(404, "Thread not found")
    return t


@router.patch("/threads/{thread_id}")
def rename_thread(thread_id: str, req: ThreadRenameRequest, user=Depends(get_current_user)):
    """Rename a thread."""
    t = thread_service.rename_thread(user["id"], thread_id, req.title)
    if not t:
        raise HTTPException(404, "Thread not found")
    return t


@router.delete("/threads/{thread_id}")
def delete_thread(thread_id: str, user=Depends(get_current_user)):
    """Delete a thread."""
    ok = thread_service.delete_thread(user["id"], thread_id)
    if not ok:
        raise HTTPException(404, "Thread not found")
    return {"ok": True, "deleted": thread_id}


@router.get("/threads/{thread_id}/history")
async def thread_history(
    thread_id: str,
    mode: str = Query("MAIN"),
    case_id: str | None = Query(None),
    user=Depends(get_current_user),
):
    """
    Return the conversation history for a thread by reading the
    LangGraph checkpointer state (persistent across restarts).
    Falls back to DB chat_messages if checkpointer has no state yet.
    """
    # Verify thread belongs to user
    t = thread_service.get_thread(user["id"], thread_id)
    if not t:
        raise HTTPException(404, "Thread not found")

    from backend.services.langgraph_graphs import get_thread_history
    history = await get_thread_history(thread_id, mode, case_id)

    if not history:
        # Fallback: read from chat_messages table
        with __import__("backend.db.database", fromlist=["get_conn", "row_to_dict"]).get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """SELECT role, content, citations, created_at as timestamp
                   FROM chat_messages WHERE thread_id=%s ORDER BY id ASC""",
                (thread_id,),
            )
            rows = cur.fetchall()
            cur.close()
        from backend.db.database import row_to_dict
        import json as _json
        for r in rows:
            d = row_to_dict(r)
            try:
                d["citations"] = _json.loads(d["citations"]) if d.get("citations") else []
            except Exception:
                d["citations"] = []
            history.append(d)

    return {"messages": history, "thread": t}

@router.post("/chat/stream")
async def chat_stream(req: ThreadChatRequest, user=Depends(get_current_user)):
    """
    Primary chat endpoint — LangGraph-backed, thread-persistent.
    Streams SSE tokens.

    Modes:
      MAIN  — No filter; searches across all documents in vector DB.
      BNS   — Filtered: source == 'BNS'  (Bharatiya Nyaya Sanhita)
      BNSS  — Filtered: source == 'BNSS' (Bharatiya Nagarik Suraksha Sanhita)
      BSA   — Filtered: source == 'BSA'  (Bharatiya Sakshya Adhiniyam)
      CNT   — Filtered: source == 'CNT'  (Constitution of India)
      IT    — Filtered: source == 'IT'   (Information Technology Act)
    """
    if not req.query.strip():
        raise HTTPException(400, "Query required")
    if req.mode not in VALID_MODES:
        raise HTTPException(400, f"mode must be one of: {', '.join(sorted(VALID_MODES))}")

    # Verify thread belongs to user
    t = thread_service.get_thread(user["id"], req.thread_id)
    if not t:
        raise HTTPException(404, "Thread not found")

    return StreamingResponse(
        chat_service.stream_thread_query(
            user_id=user["id"],
            thread_id=req.thread_id,
            mode=req.mode,
            query=req.query.strip(),
            case_id=req.case_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )



@router.get("/chat/history")
def chat_history(case_id: str | None = Query(None), user=Depends(get_current_user)):
    return {"messages": chat_service.get_chat_history(user["id"], case_id)}


@router.delete("/chat/history")
def clear_chat(case_id: str | None = Query(None), user=Depends(get_current_user)):
    chat_service.clear_chat_history(user["id"], case_id)
    return {"ok": True}


@router.post("/chat")
def chat(
    req: ChatRequest,
    case_id: str | None = Query(None),
    user=Depends(get_current_user),
):
    """Legacy streaming endpoint — kept for backward compat."""
    if not req.query.strip():
        raise HTTPException(400, "Query required")
    return StreamingResponse(
        chat_service.stream_query(user["id"], req.query.strip(), case_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

@router.post("/cases/{case_id}/notes")
def add_note(case_id: str, req: NoteRequest, user=Depends(get_current_user)):
    note = note_service.create_note(user["id"], case_id, req.content)
    activity_service.log_activity(user["id"], "Note Added", case_id)
    return note


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

@router.post("/cases/{case_id}/timeline")
def add_timeline(case_id: str, req: HearingRequest, user=Depends(get_current_user)):
    return hearing_service.add_event(user["id"], case_id, req.model_dump())


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------

@router.get("/insights")
def insights(user=Depends(get_current_user)):
    return insights_service.get_insights(user["id"])


@router.get("/search")
def search(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    user=Depends(get_current_user),
):
    clients = client_service.list_clients(user["id"], q)
    cases = case_service.list_cases(user["id"], q)
    documents = workspace_service.list_user_documents(user["id"], q)
    return {
        "clients": _paginate(clients, page, page_size)["items"],
        "cases": _paginate(cases, page, page_size)["items"],
        "documents": _paginate(documents, page, page_size)["items"],
        "total": len(clients) + len(cases) + len(documents),
    }


@router.get("/settings")
def settings(user=Depends(get_current_user)):
    status = document_service.index_status()
    return {
        "user": user,
        "index_status": status,
        "pgvector_active": status == "Active",
    }
