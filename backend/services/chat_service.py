import json
import time
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict
from backend.services.activity_service import log_activity
from backend.services.case_service import get_case
from backend.services.stats_service import record_query
from rag.query_engine import query_engine

try:
    from llama_index.core.vector_stores import ExactMatchFilter, MetadataFilters
    from rag.query_engine import index, llm
    HAS_FILTER = True
except ImportError:
    HAS_FILTER = False


def _now():
    return datetime.now(timezone.utc).isoformat()


def get_chat_history(user_id: str, case_id: str = None):
    with get_conn() as conn:
        if case_id:
            rows = conn.execute(
                """SELECT role, content, citations, created_at as timestamp
                FROM chat_messages WHERE user_id=? AND case_id=? ORDER BY id ASC""",
                (user_id, case_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT role, content, citations, created_at as timestamp
                FROM chat_messages WHERE user_id=? AND case_id IS NULL ORDER BY id ASC""",
                (user_id,),
            ).fetchall()
    out = []
    for r in rows:
        d = row_to_dict(r)
        try:
            d["citations"] = json.loads(d["citations"]) if d.get("citations") else []
        except json.JSONDecodeError:
            d["citations"] = []
        out.append(d)
    return out


def save_message(user_id, role, content, citations=None, case_id=None):
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO chat_messages (user_id, case_id, role, content, citations, created_at)
            VALUES (?,?,?,?,?,?)""",
            (user_id, case_id, role, content, json.dumps(citations or []), _now()),
        )


def clear_chat_history(user_id: str, case_id: str = None):
    with get_conn() as conn:
        if case_id:
            conn.execute("DELETE FROM chat_messages WHERE user_id=? AND case_id=?", (user_id, case_id))
        else:
            conn.execute("DELETE FROM chat_messages WHERE user_id=? AND case_id IS NULL", (user_id,))


def run_query(user_id: str, query: str, case_id: str = None):
    prompt = query
    engine = query_engine

    if case_id:
        case = get_case(user_id, case_id)
        if case:
            ctx = (
                f"Case: {case.get('title')}. Court: {case.get('court')}. "
                f"Petitioner: {case.get('petitioner')}. Respondent: {case.get('respondent')}. "
                f"Status: {case.get('status')}.\n\nUser question: {query}"
            )
            prompt = ctx
        if HAS_FILTER:
            try:
                filters = MetadataFilters(filters=[
                    ExactMatchFilter(key="case_id", value=case_id),
                    ExactMatchFilter(key="user_id", value=user_id),
                ])
                engine = index.as_query_engine(llm=llm, similarity_top_k=5, filters=filters)
            except Exception:
                pass

    start = time.time()
    response = engine.query(prompt)
    elapsed_ms = int((time.time() - start) * 1000)

    citations = []
    seen = set()
    for node in response.source_nodes:
        fn = node.metadata.get("file_name", "Unknown")
        key = fn + (node.text[:40] if node.text else "")
        if key not in seen:
            seen.add(key)
            citations.append({"file_name": fn, "snippet": (node.text or "")[:350]})

    record_query(user_id, elapsed_ms, len(citations))
    log_activity(user_id, "Case AI Research" if case_id else "AI Legal Research", query[:120])
    save_message(user_id, "user", query, case_id=case_id)
    save_message(user_id, "assistant", str(response.response), citations, case_id=case_id)

    return {
        "answer": str(response.response),
        "citations": citations,
        "response_time_sec": round(elapsed_ms / 1000, 2),
    }
