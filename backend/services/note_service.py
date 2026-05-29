import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def list_notes(user_id: str, case_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM notes WHERE user_id=%s AND case_id=%s ORDER BY created_at DESC",
            (user_id, case_id),
        )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]


def create_note(user_id: str, case_id: str, content: str):
    nid = str(uuid.uuid4())[:10]
    now = _now()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO notes (id, user_id, case_id, content, created_at, updated_at) VALUES (%s,%s,%s,%s,%s,%s)",
            (nid, user_id, case_id, content.strip(), now, now),
        )
        cur.close()
    return get_note(user_id, nid)


def get_note(user_id: str, note_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM notes WHERE id=%s AND user_id=%s", (note_id, user_id)
        )
        row = cur.fetchone()
        cur.close()
    return row_to_dict(row)
