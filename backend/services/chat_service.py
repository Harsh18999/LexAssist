"""
chat_service.py — LangGraph-powered chat with persistent thread checkpointing.

Modes:
  MAIN  — Global RAG over all documents (no source filter)
  BNS   — Filtered by source == 'BNS'  (Bharatiya Nyaya Sanhita)
  BNSS  — Filtered by source == 'BNSS' (Bharatiya Nagarik Suraksha Sanhita)
  BSA   — Filtered by source == 'BSA'  (Bharatiya Sakshya Adhiniyam)
  CNT   — Filtered by source == 'CNT'  (Constitution of India)
  IT    — Filtered by source == 'IT'   (Information Technology Act)

Each conversation is a "thread" whose state is persisted by the
AsyncPostgresSaver checkpointer in PostgreSQL.  The old simple
streaming helpers (stream_query / run_query) are preserved for
backward compatibility with the legacy /chat endpoint.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import AsyncGenerator, Generator

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from backend.db.database import get_conn, row_to_dict
from backend.services.activity_service import log_activity
from backend.services.case_service import get_case
from backend.services.stats_service import record_query
from backend.services.thread_service import touch_thread
from rag.query_engine import get_rag_chain, get_retriever, build_rag_chain, llm


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Legacy chat history helpers (kept for backward compat)
# ---------------------------------------------------------------------------

def get_chat_history(user_id: str, case_id: str = None) -> list:
    with get_conn() as conn:
        cur = conn.cursor()
        if case_id:
            cur.execute(
                """SELECT role, content, citations, created_at as timestamp
                FROM chat_messages WHERE user_id=%s AND case_id=%s ORDER BY id ASC""",
                (user_id, case_id),
            )
        else:
            cur.execute(
                """SELECT role, content, citations, created_at as timestamp
                FROM chat_messages WHERE user_id=%s AND case_id IS NULL ORDER BY id ASC""",
                (user_id,),
            )
        rows = cur.fetchall()
        cur.close()
    out = []
    for r in rows:
        d = row_to_dict(r)
        try:
            d["citations"] = json.loads(d["citations"]) if d.get("citations") else []
        except json.JSONDecodeError:
            d["citations"] = []
        out.append(d)
    return out


def save_message(user_id: str, role: str, content: str, citations: list = None, case_id: str = None, thread_id: str = None) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO chat_messages (user_id, case_id, role, content, citations, created_at, thread_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (user_id, case_id, role, content, json.dumps(citations or []), _now(), thread_id),
        )
        cur.close()


def clear_chat_history(user_id: str, case_id: str = None) -> None:
    with get_conn() as conn:
        cur = conn.cursor()
        if case_id:
            cur.execute("DELETE FROM chat_messages WHERE user_id=%s AND case_id=%s", (user_id, case_id))
        else:
            cur.execute("DELETE FROM chat_messages WHERE user_id=%s AND case_id IS NULL", (user_id,))
        cur.close()


# ---------------------------------------------------------------------------
# Build retriever (optionally filtered by case)
# ---------------------------------------------------------------------------

def _build_retriever(user_id: str, case_id: str = None):
    """Return a LangChain retriever, optionally filtered by case metadata."""
    if case_id:
        search_kwargs = {
            "k": 5,
            "filter": {"case_id": case_id, "user_id": user_id},
        }
    else:
        search_kwargs = {"k": 5}
    return get_retriever(search_kwargs)


def _build_prompt_prefix(user_id: str, case_id: str = None) -> str:
    """Prepend case context to the user query when inside a case."""
    if not case_id:
        return ""
    case = get_case(user_id, case_id)
    if not case:
        return ""
    return (
        f"Case context — Title: {case.get('title')}. Court: {case.get('court')}. "
        f"Petitioner: {case.get('petitioner')}. Respondent: {case.get('respondent')}. "
        f"Status: {case.get('status')}.\n\n"
    )


def _get_case_context_str(user_id: str, case_id: str) -> str:
    """Return a brief case-context string for LangGraph injection."""
    case = get_case(user_id, case_id)
    if not case:
        return ""
    return (
        f"Title: {case.get('title')} | Court: {case.get('court')} | "
        f"Petitioner: {case.get('petitioner')} | Respondent: {case.get('respondent')} | "
        f"Status: {case.get('status')}"
    )


# ---------------------------------------------------------------------------
# LangGraph-powered streaming (NEW — primary path)
# ---------------------------------------------------------------------------

async def stream_thread_query(
    user_id: str,
    thread_id: str,
    mode: str,
    query: str,
    case_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Async SSE generator backed by LangGraph.

    Yields SSE lines:
      data: {"type": "chunk",  "content": "..."}
      data: {"type": "done",   "citations": [...], "response_time_sec": 1.2}
      data: {"type": "error",  "content": "..."}
    """
    from backend.services.langgraph_graphs import run_graph_streaming

    case_context = ""
    if case_id:
        case_context = _get_case_context_str(user_id, case_id)

    start = time.time()
    final_answer = ""
    citations: list[dict] = []

    try:
        async for event in run_graph_streaming(
            thread_id=thread_id,
            mode=mode,
            query=query,
            case_id=case_id,
            case_context=case_context,
        ):
            if event["type"] == "chunk":
                final_answer += event["content"]
                yield f"data: {json.dumps({'type': 'chunk', 'content': event['content']})}\n\n"
            elif event["type"] == "done":
                citations = event.get("citations", [])
                final_answer = event.get("final_answer", final_answer)
            elif event["type"] == "error":
                yield f"data: {json.dumps({'type': 'error', 'content': event['content']})}\n\n"
                return

    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"
        return

    elapsed_ms = int((time.time() - start) * 1000)

    # Persist to DB + update thread timestamp
    record_query(user_id, elapsed_ms, len(citations))
    _mode_labels = {
        "MAIN": "AI Legal Research",
        "BNS":  "BNS Research",
        "BNSS": "BNSS Research",
        "BSA":  "BSA Research",
        "CNT":  "Constitution Research",
        "IT":   "IT Act Research",
    }
    activity_label = _mode_labels.get(mode, "AI Legal Research")
    log_activity(user_id, activity_label, query[:120])
    save_message(user_id, "user", query, case_id=case_id, thread_id=thread_id)
    save_message(user_id, "assistant", final_answer, citations, case_id=case_id, thread_id=thread_id)
    touch_thread(user_id, thread_id)

    yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'response_time_sec': round(elapsed_ms / 1000, 2)})}\n\n"


def stream_thread_query_sync(
    user_id: str,
    thread_id: str,
    mode: str,
    query: str,
    case_id: str | None = None,
) -> Generator[str, None, None]:
    """
    Synchronous generator wrapper around stream_thread_query for FastAPI
    StreamingResponse (which runs in a sync context).
    """
    loop = asyncio.new_event_loop()

    async def _collect():
        results = []
        async for chunk in stream_thread_query(user_id, thread_id, mode, query, case_id):
            results.append(chunk)
        return results

    try:
        chunks = loop.run_until_complete(_collect())
        for chunk in chunks:
            yield chunk
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# Legacy SSE generator (preserved for backward compat with /chat endpoint)
# ---------------------------------------------------------------------------

class _SSEHandler(BaseCallbackHandler):
    """Collect streamed tokens and push them into a list for the generator."""
    def __init__(self, buffer: list):
        self._buf = buffer

    def on_llm_new_token(self, token: str, **kwargs) -> None:
        self._buf.append(("chunk", token))

    def on_llm_end(self, response: LLMResult, **kwargs) -> None:
        self._buf.append(("done", None))

    def on_llm_error(self, error: Exception, **kwargs) -> None:
        self._buf.append(("error", str(error)))


def stream_query(user_id: str, query: str, case_id: str = None) -> Generator[str, None, None]:
    """
    Legacy SSE generator (used by old /chat endpoint).
    Preserved for backward compatibility.
    """
    prefix = _build_prompt_prefix(user_id, case_id)
    full_query = prefix + query

    token_buffer: list = []
    handler = _SSEHandler(token_buffer)

    retriever = _build_retriever(user_id, case_id)
    chain = build_rag_chain(retriever)

    start = time.time()
    full_response = ""
    citations = []

    try:
        result = chain.invoke(
            {"query": full_query},
            config={"callbacks": [handler]},
        )

        for event_type, content in token_buffer:
            if event_type == "chunk":
                full_response += content
                yield f"data: {json.dumps({'type': 'chunk', 'content': content})}\n\n"
            elif event_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'content': content})}\n\n"
                return

        if not full_response:
            full_response = result.get("result", "")
            yield f"data: {json.dumps({'type': 'chunk', 'content': full_response})}\n\n"

        seen: set = set()
        for doc in result.get("source_documents", []):
            src = doc.metadata.get("source") or doc.metadata.get("file_name", "Unknown")
            key = src + doc.page_content[:40]
            if key not in seen:
                seen.add(key)
                citations.append({
                    "file_name": src,
                    "snippet": doc.page_content[:350],
                })

    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'content': str(exc)})}\n\n"
        return

    elapsed_ms = int((time.time() - start) * 1000)

    record_query(user_id, elapsed_ms, len(citations))
    log_activity(user_id, "Case AI Research" if case_id else "AI Legal Research", query[:120])
    save_message(user_id, "user", query, case_id=case_id)
    save_message(user_id, "assistant", full_response, citations, case_id=case_id)

    yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'response_time_sec': round(elapsed_ms / 1000, 2)})}\n\n"


# ---------------------------------------------------------------------------
# Non-streaming fallback (legacy)
# ---------------------------------------------------------------------------

def run_query(user_id: str, query: str, case_id: str = None) -> dict:
    """Collect the full response and return as a dict (non-streaming)."""
    prefix = _build_prompt_prefix(user_id, case_id)
    full_query = prefix + query

    retriever = _build_retriever(user_id, case_id)
    chain = build_rag_chain(retriever)

    start = time.time()
    result = chain.invoke({"query": full_query})
    elapsed_ms = int((time.time() - start) * 1000)

    full_response = result.get("result", "")
    citations = []
    seen: set = set()
    for doc in result.get("source_documents", []):
        src = doc.metadata.get("source") or doc.metadata.get("file_name", "Unknown")
        key = src + doc.page_content[:40]
        if key not in seen:
            seen.add(key)
            citations.append({"file_name": src, "snippet": doc.page_content[:350]})

    record_query(user_id, elapsed_ms, len(citations))
    log_activity(user_id, "Case AI Research" if case_id else "AI Legal Research", query[:120])
    save_message(user_id, "user", query, case_id=case_id)
    save_message(user_id, "assistant", full_response, citations, case_id=case_id)

    return {
        "answer": full_response,
        "citations": citations,
        "response_time_sec": round(elapsed_ms / 1000, 2),
    }
