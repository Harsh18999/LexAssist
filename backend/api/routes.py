import os
import tempfile

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.api.deps import get_current_user
from backend.services import (
    activity_service,
    brief_service,
    case_service,
    chat_service,
    client_service,
    dashboard_service,
    document_service,
    hearing_service,
    note_service,
    upload_service,
    workspace_service,
)
from backend.services import insights_service

router = APIRouter()


class ChatRequest(BaseModel):
    query: str


class ClientRequest(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    address: str = ""
    advocate: str = ""
    jurisdiction: str = ""


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


@router.get("/dashboard")
def dashboard(user=Depends(get_current_user)):
    return dashboard_service.get_dashboard(user["id"])


@router.get("/me")
def me(user=Depends(get_current_user)):
    return user


# --- Clients ---
@router.get("/clients")
def clients(search: str = "", user=Depends(get_current_user)):
    return {"clients": client_service.list_clients(user["id"], search)}


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


# --- Cases ---
@router.get("/cases")
def cases(search: str = "", client_id: str = None, user=Depends(get_current_user)):
    return {"cases": case_service.list_cases(user["id"], search, client_id)}


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
    case["suggested_actions"] = brief_service.suggested_actions(case)
    return case


@router.patch("/cases/{case_id}")
def update_case(case_id: str, req: CaseRequest, user=Depends(get_current_user)):
    data = {k: v for k, v in req.model_dump().items() if v is not None and v != ""}
    case = case_service.update_case(user["id"], case_id, data)
    if not case:
        raise HTTPException(404, "Case not found")
    return case


@router.post("/cases/{case_id}/documents")
async def upload_case_doc(case_id: str, file: UploadFile = File(...), user=Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF allowed")
    content = await file.read()
    doc = workspace_service.save_case_document(user["id"], case_id, file.filename, content)
    activity_service.log_activity(user["id"], "Case Document Uploaded", file.filename)
    return doc


# --- Chat ---
@router.get("/chat/history")
def chat_history(case_id: str | None = Query(None), user=Depends(get_current_user)):
    return {"messages": chat_service.get_chat_history(user["id"], case_id)}


@router.delete("/chat/history")
def clear_chat(case_id: str | None = Query(None), user=Depends(get_current_user)):
    chat_service.clear_chat_history(user["id"], case_id)
    return {"ok": True}


@router.post("/chat")
def chat(req: ChatRequest, case_id: str | None = Query(None), user=Depends(get_current_user)):
    if not req.query.strip():
        raise HTTPException(400, "Query required")
    return chat_service.run_query(user["id"], req.query.strip(), case_id)


# --- Notes ---
@router.post("/cases/{case_id}/notes")
def add_note(case_id: str, req: NoteRequest, user=Depends(get_current_user)):
    note = note_service.create_note(user["id"], case_id, req.content)
    activity_service.log_activity(user["id"], "Note Added", case_id)
    return note


# --- Timeline ---
@router.post("/cases/{case_id}/timeline")
def add_timeline(case_id: str, req: HearingRequest, user=Depends(get_current_user)):
    return hearing_service.add_event(user["id"], case_id, req.model_dump())


# --- Brief ---
@router.post("/cases/{case_id}/brief")
async def case_brief(case_id: str, file: UploadFile = File(None), user=Depends(get_current_user)):
    try:
        if file:
            content = await file.read()
            brief = brief_service.generate_brief_from_bytes(content, file.filename, user["id"])
        else:
            docs = workspace_service.list_case_documents(user["id"], case_id)
            if not docs:
                raise HTTPException(400, "Upload a document first")
            with open(docs[0]["file_path"], "rb") as f:
                brief = brief_service.generate_brief_from_bytes(f.read(), docs[0]["filename"], user["id"])
        case_service.save_brief(user["id"], case_id, brief)
        case_service.update_case(user["id"], case_id, {
            "title": brief.get("case_title") or "Case",
            "court": brief.get("court", ""),
            "judgment_date": brief.get("judgment_date", ""),
            "petitioner": brief.get("petitioner", ""),
            "respondent": brief.get("respondent", ""),
            "acts_involved": ", ".join(brief.get("acts_involved", []) or []),
            "constitutional_articles": ", ".join(brief.get("constitutional_articles", []) or []),
        })
        activity_service.log_activity(user["id"], "Case Brief Generated", case_id)
        return brief
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.post("/brief/generate")
async def generate_brief(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    return brief_service.generate_brief_from_bytes(content, file.filename, user["id"])


@router.post("/brief/pdf")
async def brief_pdf(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    brief = brief_service.generate_brief_from_bytes(content, file.filename, user["id"])
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.close()
    brief_service.brief_to_pdf(brief, tmp.name)
    return FileResponse(tmp.name, media_type="application/pdf", filename="jurisai_brief.pdf")


# --- Knowledge / Upload ---
@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_current_user)):
    content = await file.read()
    return workspace_service.save_global_document(user["id"], file.filename, content)


@router.post("/index/rebuild")
def rebuild(user=Depends(get_current_user)):
    return upload_service.rebuild_index(user["id"])


@router.get("/knowledge-base")
def knowledge(search: str = "", user=Depends(get_current_user)):
    docs = workspace_service.list_user_documents(user["id"], search)
    legacy = document_service.list_documents(search)
    return {
        "documents": docs + [{"filename": d["filename"], "path": d["path"], "category": d["category"], "upload_date": d["upload_date"], "size_label": d["size_label"], "legacy": True} for d in legacy],
        "index_status": document_service.index_status(),
    }


@router.get("/documents/preview")
def preview(path: str, user=Depends(get_current_user)):
    p = document_service.get_document_preview(path)
    if not p:
        raise HTTPException(404)
    return p


@router.get("/insights")
def insights(user=Depends(get_current_user)):
    return insights_service.get_insights(user["id"])


@router.get("/search")
def search(q: str = "", user=Depends(get_current_user)):
    return {
        "clients": client_service.list_clients(user["id"], q),
        "cases": case_service.list_cases(user["id"], q),
        "documents": workspace_service.list_user_documents(user["id"], q),
    }


@router.get("/settings")
def settings(user=Depends(get_current_user)):
    return {
        "user": user,
        "index_status": document_service.index_status(),
        "chroma_exists": os.path.exists("Data/Processed/chroma_db"),
    }
