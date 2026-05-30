"""
document_ai_service.py — Document-scoped AI chat.

Flow:
  1. Validate document belongs to user and is in 'completed' state.
  2. Retrieve the top-k chunks from DOCUMENT_VECTOR_DB filtered by document_id.
  3. Build a strict system prompt: "answer only from these passages".
  4. Invoke LLM and drip-feed the response as SSE chunks.

Yields SSE-compatible dicts:
  {"type": "status",  "content": "Searching document…"}
  {"type": "chunk",   "content": "<token>"}
  {"type": "done",    "citations": [...], "response_time_sec": 1.2}
  {"type": "error",   "content": "<message>"}
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import AsyncGenerator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_document(user_id: str, doc_id: str) -> dict | None:
    """Return the document row or None if not found / not owned by user."""
    try:
        from backend.db.database import get_conn, row_to_dict
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM documents WHERE id=%s AND user_id=%s",
                (doc_id, user_id),
            )
            row = cur.fetchone()
            cur.close()
        return row_to_dict(row) if row else None
    except Exception as exc:
        print(f"[document_ai] DB lookup failed: {exc}")
        return None


async def _retrieve_chunks(doc_id: str, query: str, k: int = 6) -> list:
    """Retrieve the top-k chunks from DOCUMENT_VECTOR_DB filtered by document_id."""
    from rag.query_engine import get_doc_retriever
    retriever = await get_doc_retriever({
        "k": k,
        "filter": {"document_id": doc_id},
    })
    return await retriever.ainvoke(query)


def _build_citations(docs: list) -> list[dict]:
    seen: set = set()
    citations: list[dict] = []
    for doc in docs:
        src = doc.metadata.get("source") or doc.metadata.get("file_name", "Document")
        key = src + doc.page_content[:40]
        if key not in seen:
            seen.add(key)
            citations.append({
                "file_name": src,
                "snippet": doc.page_content[:350],
            })
    return citations


# ---------------------------------------------------------------------------
# Main streaming generator
# ---------------------------------------------------------------------------

async def stream_document_query(
    user_id: str,
    doc_id: str,
    query: str,
    history: list[dict] = None,
) -> AsyncGenerator[str, None]:
    """
    Async SSE generator for Document AI.

    Yields SSE lines like:
      data: {"type": "chunk", "content": "..."}\\n\\n
      data: {"type": "done", "citations": [...], "response_time_sec": 1.2}\\n\\n
      data: {"type": "error", "content": "..."}\\n\\n
    """
    start = time.time()

    # ── 1. Validate document ────────────────────────────────────────────────
    doc = _get_document(user_id, doc_id)
    if not doc:
        yield f"data: {json.dumps({'type': 'error', 'content': 'Document not found or access denied.'})}\n\n"
        return

    status = doc.get("status", "")
    if status == "processing":
        yield f"data: {json.dumps({'type': 'error', 'content': 'Document is still being processed. Please wait until indexing is complete.'})}\n\n"
        return
    if status == "error":
        err_detail = doc.get("processing_error") or "Document processing failed."
        yield f"data: {json.dumps({'type': 'error', 'content': f'Document processing error: {err_detail}'})}\n\n"
        return
    if status not in ("completed", "pending"):
        # "pending" for standalone uploads (not case-indexed) — allow basic retrieval attempt
        pass

    # ── 2. Retrieve relevant chunks ─────────────────────────────────────────
    yield f"data: {json.dumps({'type': 'status', 'content': 'Searching document…'})}\n\n"

    try:
        docs = await _retrieve_chunks(doc_id, query)
    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'content': f'Retrieval failed: {exc}'})}\n\n"
        return

    citations = _build_citations(docs)

    if not docs:
        # No chunks found — LLM will acknowledge it has no context
        context = "(No relevant passages found in this document for the given query.)"
    else:
        context = "\n\n---\n\n".join(d.page_content for d in docs)

    # ── 3. Build system prompt (strict document-only) ───────────────────────
    filename = doc.get("filename", "the document")
    system_prompt = (
        f"You are a legal AI assistant helping a lawyer analyse a specific document: \"{filename}\".\n"
        "You MUST answer ONLY based on the document passages provided below. "
        "Do NOT use any external knowledge or prior training data. "
        "If the answer cannot be found in the provided passages, say so clearly.\n\n"
        f"Document Passages:\n{context}"
    )

    # ── 4. Invoke LLM and stream the response ───────────────────────────────
    yield f"data: {json.dumps({'type': 'status', 'content': 'Writing response…'})}\n\n"

    try:
        from rag.query_engine import llm
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage

        msgs = [SystemMessage(content=system_prompt)]
        if history:
            for msg in history:
                role = msg.get("role", "")
                content = msg.get("content", "")
                if role == "user":
                    msgs.append(HumanMessage(content=content))
                elif role == "assistant":
                    msgs.append(AIMessage(content=content))
        msgs.append(HumanMessage(content=query))

        final_answer = ""
        async for chunk in llm.astream(msgs):
            token = chunk.content
            if isinstance(token, list):
                token = "".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in token)
            if token:
                final_answer += token
                yield f"data: {json.dumps({'type': 'chunk', 'content': token})}\n\n"
                await asyncio.sleep(0.01)

    except Exception as exc:
        yield f"data: {json.dumps({'type': 'error', 'content': f'LLM error: {exc}'})}\n\n"
        return

    elapsed = round(time.time() - start, 2)
    yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'response_time_sec': elapsed})}\n\n"
