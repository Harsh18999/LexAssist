import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def list_clients(user_id: str, search: str = ""):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    clients = [row_to_dict(r) for r in rows]
    if search:
        s = search.lower()
        clients = [
            c for c in clients
            if s in (c.get("name") or "").lower()
            or s in (c.get("email") or "").lower()
        ]
    for c in clients:
        c["case_count"] = count_client_cases(user_id, c["id"])
    return clients


def count_client_cases(user_id: str, client_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as n FROM cases WHERE user_id = ? AND client_id = ?",
            (user_id, client_id),
        ).fetchone()
    return row["n"] if row else 0


def get_client(user_id: str, client_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM clients WHERE id = ? AND user_id = ?",
            (client_id, user_id),
        ).fetchone()
    return row_to_dict(row)


def create_client(user_id: str, data: dict):
    cid = str(uuid.uuid4())[:10]
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO clients
            (id, user_id, name, phone, email, address, advocate, jurisdiction, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                cid, user_id, data.get("name", "").strip(),
                data.get("phone"), data.get("email"), data.get("address"),
                data.get("advocate"), data.get("jurisdiction"), _now(),
            ),
        )
    return get_client(user_id, cid)


def update_client(user_id: str, client_id: str, data: dict):
    client = get_client(user_id, client_id)
    if not client:
        return None
    with get_conn() as conn:
        conn.execute(
            """UPDATE clients SET name=?, phone=?, email=?, address=?,
            advocate=?, jurisdiction=? WHERE id=? AND user_id=?""",
            (
                data.get("name", client["name"]),
                data.get("phone", client.get("phone")),
                data.get("email", client.get("email")),
                data.get("address", client.get("address")),
                data.get("advocate", client.get("advocate")),
                data.get("jurisdiction", client.get("jurisdiction")),
                client_id, user_id,
            ),
        )
    return get_client(user_id, client_id)


def count_clients(user_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as n FROM clients WHERE user_id = ?", (user_id,)
        ).fetchone()
    return row["n"] if row else 0
