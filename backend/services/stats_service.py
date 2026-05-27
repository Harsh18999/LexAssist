from backend.db.database import get_conn, row_to_dict


def get_user_stats(user_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_stats WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        with get_conn() as conn:
            conn.execute("INSERT INTO user_stats (user_id) VALUES (?)", (user_id,))
        return {"user_id": user_id, "ai_queries": 0, "total_response_ms": 0, "retrieval_count": 0, "last_indexed": None}
    return row_to_dict(row)


def record_query(user_id: str, response_time_ms: int, source_count: int = 0):
    stats = get_user_stats(user_id)
    with get_conn() as conn:
        conn.execute(
            """UPDATE user_stats SET
            ai_queries = ?, total_response_ms = ?, retrieval_count = ?
            WHERE user_id = ?""",
            (
                stats.get("ai_queries", 0) + 1,
                stats.get("total_response_ms", 0) + response_time_ms,
                stats.get("retrieval_count", 0) + source_count,
                user_id,
            ),
        )


def set_last_indexed(user_id: str, timestamp: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE user_stats SET last_indexed = ? WHERE user_id = ?",
            (timestamp, user_id),
        )


def average_response_time(user_id: str):
    stats = get_user_stats(user_id)
    q = stats.get("ai_queries", 0)
    if not q:
        return 0
    return round(stats.get("total_response_ms", 0) / q / 1000, 2)
