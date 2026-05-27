import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def list_notes(user_id: str, case_id: str):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM notes WHERE user_id=? AND case_id=? ORDER BY created_at DESC",
            (user_id, case_id),
        ).fetchall()
    return [row_to_dict(r) for r in rows]


def create_note(user_id: str, case_id: str, content: str):
    nid = str(uuid.uuid4())[:10]
    now = _now()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO notes (id, user_id, case_id, content, created_at, updated_at) VALUES (?,?,?,?,?,?)",
            (nid, user_id, case_id, content.strip(), now, now),
        )
    return get_note(user_id, nid)


def get_note(user_id: str, note_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM notes WHERE id=? AND user_id=?", (note_id, user_id)
        ).fetchone()
    return row_to_dict(row)
