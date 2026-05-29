from backend.db.database import get_conn
from backend.services.document_service import index_status


def get_dashboard(user_id: str):
    """
    Build dashboard data in TWO connections total:
     1. All aggregate counts + recent activity + upcoming hearings in one query.
     2. index_status() (separate — hits a vector table, not user tables).
    Stats (ai_queries, last_indexed) are also fetched in the same connection.
    """
    with get_conn() as conn:
        cur = conn.cursor()

        # ── All counts + stats in a single round-trip ──────────────────────
        cur.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM clients   WHERE user_id = %s)                          AS total_clients,
                (SELECT COUNT(*) FROM cases     WHERE user_id = %s)                          AS total_cases,
                (SELECT COUNT(*) FROM cases     WHERE user_id = %s AND status = 'Active')    AS active_cases,
                (SELECT COUNT(*) FROM cases     WHERE user_id = %s AND status = 'Hearing')   AS pending_hearings,
                (SELECT COUNT(*) FROM documents WHERE user_id = %s)                          AS uploaded_documents,
                (SELECT COUNT(*) FROM cases     WHERE user_id = %s
                    AND brief_json IS NOT NULL AND brief_json != '')                          AS recent_briefs,
                (SELECT COALESCE(ai_queries, 0)  FROM user_stats WHERE user_id = %s LIMIT 1) AS ai_queries,
                (SELECT last_indexed             FROM user_stats WHERE user_id = %s LIMIT 1) AS last_indexed
            """,
            (user_id,) * 8,
        )
        counts = cur.fetchone()

        # ── Recent activity (8 rows) ────────────────────────────────────────
        cur.execute(
            """
            SELECT action, detail, created_at AS timestamp
            FROM activity_logs
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 8
            """,
            (user_id,),
        )
        recent_activity = [dict(r) for r in cur.fetchall()]

        # ── Upcoming hearings (5 rows) ──────────────────────────────────────
        cur.execute(
            """
            SELECT c.id, c.title, c.hearing_date, c.court, cl.name AS client_name
            FROM cases c
            LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.user_id = %s
              AND c.hearing_date IS NOT NULL AND c.hearing_date != ''
            ORDER BY c.hearing_date ASC
            LIMIT 5
            """,
            (user_id,),
        )
        upcoming_hearings = [dict(r) for r in cur.fetchall()]
        cur.close()

    return {
        "total_clients":      counts["total_clients"],
        "total_cases":        counts["total_cases"],
        "active_cases":       counts["active_cases"],
        "uploaded_documents": counts["uploaded_documents"],
        "ai_queries":         counts["ai_queries"] or 0,
        "pending_hearings":   counts["pending_hearings"],
        "recent_briefs":      counts["recent_briefs"],
        "recent_activity":    recent_activity,
        "upcoming_hearings":  upcoming_hearings,
        "index_status":       index_status(),
        "last_indexed":       counts["last_indexed"],
    }
