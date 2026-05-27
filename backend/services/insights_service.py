import os

import chromadb

from backend.db.database import get_conn
from backend.services.stats_service import average_response_time, get_user_stats
from backend.services.workspace_service import count_documents

CHROMA_PATH = "Data/Processed/chroma_db"


def get_insights(user_id: str):
    stats = get_user_stats(user_id)
    with get_conn() as conn:
        cases = conn.execute("SELECT COUNT(*) as n FROM cases WHERE user_id=?", (user_id,)).fetchone()["n"]
    return {
        "total_documents": count_documents(user_id),
        "total_cases": cases,
        "total_chunks": _count_chunks(),
        "retrieval_count": stats.get("retrieval_count", 0),
        "ai_queries": stats.get("ai_queries", 0),
        "average_response_time_sec": average_response_time(user_id),
        "last_indexed": stats.get("last_indexed"),
    }


def _count_chunks():
    if not os.path.exists(CHROMA_PATH):
        return 0
    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        return client.get_or_create_collection("jurisai_legal_docs").count()
    except Exception:
        return 0
