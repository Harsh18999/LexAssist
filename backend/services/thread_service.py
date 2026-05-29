"""
Thread service — CRUD for chat threads.

Each thread maps to a LangGraph thread_id (which IS the thread's id).
The AsyncPostgresSaver checkpointer stores the full graph state keyed
by this id, giving persistent conversation memory across restarts.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Thread CRUD
# ---------------------------------------------------------------------------

def list_threads(
    user_id: str,
    mode: str | None = None,
    case_id: str | None = None,
) -> list[dict]:
    """Return threads for a user, optionally filtered by mode and/or case_id."""
    with get_conn() as conn:
        cur = conn.cursor()
        if mode and case_id:
            cur.execute(
                """SELECT * FROM chat_threads
                   WHERE user_id=%s AND mode=%s AND case_id=%s
                   ORDER BY updated_at DESC""",
                (user_id, mode, case_id),
            )
        elif mode:
            cur.execute(
                """SELECT * FROM chat_threads
                   WHERE user_id=%s AND mode=%s AND case_id IS NULL
                   ORDER BY updated_at DESC""",
                (user_id, mode),
            )
        elif case_id:
            cur.execute(
                """SELECT * FROM chat_threads
                   WHERE user_id=%s AND case_id=%s
                   ORDER BY updated_at DESC""",
                (user_id, case_id),
            )
        else:
            cur.execute(
                """SELECT * FROM chat_threads
                   WHERE user_id=%s
                   ORDER BY updated_at DESC""",
                (user_id,),
            )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]


def create_thread(
    user_id: str,
    mode: str,
    title: str,
    case_id: str | None = None,
) -> dict:
    """Create a new thread and return it. The thread id IS the LangGraph thread_id."""
    thread_id = str(uuid.uuid4())
    now = _now()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO chat_threads (id, user_id, mode, case_id, title, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            (thread_id, user_id, mode, case_id, title, now, now),
        )
        cur.close()
    return get_thread(user_id, thread_id)


def get_thread(user_id: str, thread_id: str) -> dict | None:
    """Return a single thread or None."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM chat_threads WHERE id=%s AND user_id=%s",
            (thread_id, user_id),
        )
        row = cur.fetchone()
        cur.close()
    return row_to_dict(row)


def rename_thread(user_id: str, thread_id: str, title: str) -> dict | None:
    """Rename a thread. Returns updated thread or None if not found."""
    now = _now()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """UPDATE chat_threads SET title=%s, updated_at=%s
               WHERE id=%s AND user_id=%s""",
            (title, now, thread_id, user_id),
        )
        affected = cur.rowcount
        cur.close()
    if not affected:
        return None
    return get_thread(user_id, thread_id)


def touch_thread(user_id: str, thread_id: str) -> None:
    """Update updated_at to now (called after each message)."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE chat_threads SET updated_at=%s WHERE id=%s AND user_id=%s",
            (_now(), thread_id, user_id),
        )
        cur.close()


def delete_thread(user_id: str, thread_id: str) -> bool:
    """Delete a thread row. The LangGraph checkpoint rows are left for the
    checkpointer to manage (they are namespaced by thread_id)."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM chat_threads WHERE id=%s AND user_id=%s",
            (thread_id, user_id),
        )
        affected = cur.rowcount
        cur.close()
    return bool(affected)


def get_or_create_default_thread(
    user_id: str,
    mode: str,
    case_id: str | None = None,
    default_title: str = "New Conversation",
) -> dict:
    """
    Return the most-recently updated thread for this user/mode/case_id,
    or auto-create one if none exists. Used to provide a seamless first-open
    experience without forcing users to explicitly create threads.
    """
    threads = list_threads(user_id, mode, case_id)
    if threads:
        return threads[0]
    return create_thread(user_id, mode, default_title, case_id)
