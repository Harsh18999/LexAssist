import os
import uuid
import tempfile
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict
from backend.services import case_index_service
from backend.utils import s3_storage


def _now():
    return datetime.now(timezone.utc).isoformat()


def _get_client_id_for_case(user_id: str, case_id: str) -> str:
    """Lookup the client_id for a given case (needed for S3 key naming)."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT client_id FROM cases WHERE id=%s AND user_id=%s",
            (case_id, user_id),
        )
        row = cur.fetchone()
        cur.close()
    if not row:
        raise ValueError(f"Case {case_id!r} not found for user {user_id!r}")
    return row["client_id"]


# ---------------------------------------------------------------------------
# Upload document (case or standalone)
# ---------------------------------------------------------------------------

def save_case_document(user_id: str, case_id: str, filename: str, content: bytes):
    """Upload a PDF to S3 under Documents/ and register it for a case.

    S3 key: Documents/{client_id}_{case_id}_{doc_id}.pdf
    """
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are allowed.")

    client_id = _get_client_id_for_case(user_id, case_id)
    doc_id = str(uuid.uuid4())[:10]
    s3_key = s3_storage.build_case_key(client_id, case_id, doc_id)
    s3_storage.upload_pdf(s3_key, content)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO documents
               (id, user_id, client_id, case_id, filename, file_path, s3_key, size_bytes, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (doc_id, user_id, client_id, case_id, filename, s3_key, s3_key, len(content), _now()),
        )
        cur.close()

    # Index in vector store
    case_index_service.index_case_document(user_id, case_id, s3_key, filename)
    return get_document(user_id, doc_id)


def save_document(user_id: str, filename: str, content: bytes):
    """Upload a standalone PDF to S3 Documents/ (not case-specific).

    S3 key: Documents/{user_id}_{doc_id}.pdf
    """
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are allowed.")

    doc_id = str(uuid.uuid4())[:10]
    s3_key = s3_storage.build_upload_key(user_id, doc_id)
    s3_storage.upload_pdf(s3_key, content)

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO documents
               (id, user_id, filename, file_path, s3_key, doc_type, size_bytes, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (doc_id, user_id, filename, s3_key, s3_key, "upload", len(content), _now()),
        )
        cur.close()

    return get_document(user_id, doc_id)


# ---------------------------------------------------------------------------
# Delete
# ---------------------------------------------------------------------------

def delete_document(user_id: str, doc_id: str) -> bool:
    """Delete a document from S3 and remove its DB record."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM documents WHERE id=%s AND user_id=%s",
            (doc_id, user_id),
        )
        row = cur.fetchone()
        cur.close()

    if not row:
        return False

    doc = row_to_dict(row)
    s3_key = doc.get("s3_key") or doc.get("file_path")
    if s3_key:
        try:
            s3_storage.delete_pdf(s3_key)
        except Exception:
            pass

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM documents WHERE id=%s AND user_id=%s",
            (doc_id, user_id),
        )
        cur.close()

    return True


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

def get_document(user_id: str, doc_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM documents WHERE id=%s AND user_id=%s", (doc_id, user_id)
        )
        row = cur.fetchone()
        cur.close()
    return row_to_dict(row)


def get_document_download_url(user_id: str, doc_id: str) -> str | None:
    """Return a presigned S3 URL for downloading the document."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT s3_key, file_path FROM documents WHERE id=%s AND user_id=%s",
            (doc_id, user_id),
        )
        row = cur.fetchone()
        cur.close()

    if not row:
        return None
    s3_key = row["s3_key"] or row["file_path"]
    return s3_storage.generate_presigned_url(s3_key) if s3_key else None


def list_case_documents(user_id: str, case_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM documents WHERE user_id=%s AND case_id=%s ORDER BY created_at DESC",
            (user_id, case_id),
        )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]


def list_user_documents(user_id: str, search: str = ""):
    """List all user documents with optional SQL-level ILIKE search."""
    with get_conn() as conn:
        cur = conn.cursor()
        if search:
            cur.execute(
                "SELECT * FROM documents WHERE user_id=%s AND filename ILIKE %s ORDER BY created_at DESC",
                (user_id, f"%{search}%"),
            )
        else:
            cur.execute(
                "SELECT * FROM documents WHERE user_id=%s ORDER BY created_at DESC",
                (user_id,),
            )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]


def count_documents(user_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*) as n FROM documents WHERE user_id=%s", (user_id,)
        )
        row = cur.fetchone()
        cur.close()
    return row["n"] if row else 0
