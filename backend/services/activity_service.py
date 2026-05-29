from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def log_activity(user_id: str, action: str, detail: str = ""):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO activity_logs (user_id, action, detail, created_at) VALUES (%s,%s,%s,%s)",
            (user_id, action, detail[:500], _now()),
        )
        cur.close()


def get_activities(user_id: str, limit: int = 10):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT action, detail, created_at as timestamp FROM activity_logs WHERE user_id=%s ORDER BY id DESC LIMIT %s",
            (user_id, limit),
        )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]
