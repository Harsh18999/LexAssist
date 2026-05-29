from backend.db.database import get_conn
from backend.services.stats_service import average_response_time, get_user_stats

PG_VECTOR_TABLE = "LEGAL_VECTOR_DB"


def get_insights(user_id: str) -> dict:
    """Build insights using a single DB connection for all counts."""
    stats = get_user_stats(user_id)

    with get_conn() as conn:
        cur = conn.cursor()
        # Merge documents + cases count into one connection
        cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM documents WHERE user_id = %s) AS total_documents,
                (SELECT COUNT(*) FROM cases    WHERE user_id = %s) AS total_cases
            """,
            (user_id, user_id),
        )
        counts = cur.fetchone()
        cur.close()

    return {
        "total_documents":         counts["total_documents"],
        "total_cases":             counts["total_cases"],
        "total_chunks":            _count_chunks(),
        "retrieval_count":         stats.get("retrieval_count", 0),
        "ai_queries":              stats.get("ai_queries", 0),
        "average_response_time_sec": average_response_time(user_id),
        "last_indexed":            stats.get("last_indexed"),
    }


def _count_chunks() -> int:
    """Count vector chunks in the LEGAL_VECTOR_DB table."""
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            # Table name is case-sensitive in Postgres — use quoted identifier
            cur.execute('SELECT COUNT(*) as n FROM "LEGAL_VECTOR_DB"')
            row = cur.fetchone()
            cur.close()
        return row["n"] if row else 0
    except Exception:
        return 0
