import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def list_timeline(user_id: str, case_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM hearings WHERE user_id=%s AND case_id=%s ORDER BY event_date ASC",
            (user_id, case_id),
        )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]


def add_event(user_id: str, case_id: str, data: dict):
    eid = str(uuid.uuid4())[:10]
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO hearings
            (id, user_id, case_id, event_date, event_type, court, description, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                eid, user_id, case_id, data["event_date"], data.get("event_type", "hearing"),
                data.get("court"), data.get("description"), _now(),
            ),
        )
        cur.execute("SELECT * FROM hearings WHERE id=%s", (eid,))
        row = cur.fetchone()
        cur.close()
    return row_to_dict(row)
