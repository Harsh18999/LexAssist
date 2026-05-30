import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def list_clients(user_id: str, search: str = ""):
    """List clients with case_count in a single JOIN — no N+1, search via SQL ILIKE."""
    with get_conn() as conn:
        cur = conn.cursor()
        if search:
            cur.execute(
                """
                SELECT cl.*, COUNT(c.id) AS case_count
                FROM clients cl
                LEFT JOIN cases c ON c.client_id = cl.id AND c.user_id = cl.user_id
                WHERE cl.user_id = %s
                  AND (cl.name ILIKE %s OR cl.email ILIKE %s)
                GROUP BY cl.id
                ORDER BY cl.created_at DESC
                """,
                (user_id, f"%{search}%", f"%{search}%"),
            )
        else:
            cur.execute(
                """
                SELECT cl.*, COUNT(c.id) AS case_count
                FROM clients cl
                LEFT JOIN cases c ON c.client_id = cl.id AND c.user_id = cl.user_id
                WHERE cl.user_id = %s
                GROUP BY cl.id
                ORDER BY cl.created_at DESC
                """,
                (user_id,),
            )
        rows = cur.fetchall()
        cur.close()
    return [dict(r) for r in rows]


def count_client_cases(user_id: str, client_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) as n FROM cases WHERE user_id = %s AND client_id = %s",
            (user_id, client_id),
        )
        row = cur.fetchone()
        cur.close()
    return row["n"] if row else 0


def get_client(user_id: str, client_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM clients WHERE id = %s AND user_id = %s",
            (client_id, user_id),
        )
        row = cur.fetchone()
        cur.close()
    return row_to_dict(row)


def create_client(user_id: str, data: dict):
    cid = str(uuid.uuid4())[:10]
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO clients
            (id, user_id, name, phone, email, address, advocate, jurisdiction, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                cid, user_id, data.get("name", "").strip(),
                data.get("phone"), data.get("email"), data.get("address"),
                data.get("advocate"), data.get("jurisdiction"), _now(),
            ),
        )
        cur.close()
    return get_client(user_id, cid)


def update_client(user_id: str, client_id: str, data: dict):
    client = get_client(user_id, client_id)
    if not client:
        return None
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE clients SET name=%s, phone=%s, email=%s, address=%s,
            advocate=%s, jurisdiction=%s WHERE id=%s AND user_id=%s""",
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
        cur.close()
    return get_client(user_id, client_id)


def count_clients(user_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) as n FROM clients WHERE user_id = %s", (user_id,)
        )
        row = cur.fetchone()
        cur.close()
    return row["n"] if row else 0


def delete_client(user_id: str, client_id: str, force: bool = False) -> bool:
    """
    Delete a client.
    If *force* is False and the client has cases, raises ValueError.
    If *force* is True, all cases belonging to the client are deleted first.
    Returns True if the client existed and was deleted, False if not found.
    """
    client = get_client(user_id, client_id)
    if not client:
        return False
    case_count = count_client_cases(user_id, client_id)
    if case_count > 0 and not force:
        raise ValueError(
            f"Client has {case_count} case(s). Pass force=true to delete them all."
        )
    with get_conn() as conn:
        cur = conn.cursor()
        if force and case_count > 0:
            # Must delete dependent rows before cases (FK constraints)
            cur.execute(
                """DELETE FROM notes WHERE case_id IN (
                    SELECT id FROM cases WHERE client_id = %s AND user_id = %s
                )""",
                (client_id, user_id),
            )
            cur.execute(
                """DELETE FROM hearings WHERE case_id IN (
                    SELECT id FROM cases WHERE client_id = %s AND user_id = %s
                )""",
                (client_id, user_id),
            )
            cur.execute(
                "DELETE FROM cases WHERE client_id = %s AND user_id = %s",
                (client_id, user_id),
            )
        cur.execute(
            "DELETE FROM clients WHERE id = %s AND user_id = %s",
            (client_id, user_id),
        )
        cur.close()
    return True
