import os
import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict
from backend.services import case_index_service

WORKSPACE = "Data/workspace"


def _now():
    return datetime.now(timezone.utc).isoformat()


def case_dir(user_id: str, case_id: str):
    path = os.path.join(WORKSPACE, user_id, "cases", case_id)
    os.makedirs(path, exist_ok=True)
    return path


def global_dir(user_id: str):
    path = os.path.join(WORKSPACE, user_id, "knowledge")
    os.makedirs(path, exist_ok=True)
    return path


def save_case_document(user_id: str, case_id: str, filename: str, content: bytes):
    folder = case_dir(user_id, case_id)
    path = os.path.join(folder, filename)
    with open(path, "wb") as f:
        f.write(content)
    doc_id = str(uuid.uuid4())[:10]
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO documents
            (id, user_id, client_id, case_id, filename, file_path, size_bytes, created_at)
            SELECT ?, ?, client_id, ?, ?, ?, ?, ? FROM cases WHERE id=? AND user_id=?""",
            (doc_id, user_id, case_id, filename, path, len(content), _now(), case_id, user_id),
        )
    case_index_service.index_case_document(user_id, case_id, path, filename)
    return get_document(user_id, doc_id)


def save_global_document(user_id: str, filename: str, content: bytes):
    folder = global_dir(user_id)
    path = os.path.join(folder, filename)
    with open(path, "wb") as f:
        f.write(content)
    doc_id = str(uuid.uuid4())[:10]
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO documents
            (id, user_id, filename, file_path, doc_type, size_bytes, created_at)
            VALUES (?,?,?,?,?,?,?)""",
            (doc_id, user_id, filename, path, "corpus", len(content), _now()),
        )
    return get_document(user_id, doc_id)


def list_case_documents(user_id: str, case_id: str):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM documents WHERE user_id=? AND case_id=? ORDER BY created_at DESC",
            (user_id, case_id),
        ).fetchall()
    return [row_to_dict(r) for r in rows]


def list_user_documents(user_id: str, search: str = ""):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM documents WHERE user_id=? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    docs = [row_to_dict(r) for r in rows]
    if search:
        s = search.lower()
        docs = [d for d in docs if s in d["filename"].lower()]
    return docs


def get_document(user_id: str, doc_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM documents WHERE id=? AND user_id=?", (doc_id, user_id)
        ).fetchone()
    return row_to_dict(row)


def count_documents(user_id: str):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as n FROM documents WHERE user_id=?", (user_id,)
        ).fetchone()
    return row["n"] if row else 0
