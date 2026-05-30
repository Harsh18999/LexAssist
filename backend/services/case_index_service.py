"""
case_index_service.py — indexes case-specific PDFs into DOCUMENT_VECTOR_DB.

Flow:
  1. Set document status = 'processing' in DB
  2. Download PDF from S3 (PyMuPDF / fitz)
  3. Extract full text, chunk with RecursiveCharacterTextSplitter(1000, 200)
  4. Attach metadata: { document_id, case_id, source, file_name, ... }
  5. Upsert chunks into DOCUMENT_VECTOR_DB (separate from statute-law LEGAL_VECTOR_DB)
  6. Set status = 'completed' on success, 'error' on failure
"""

import os
import uuid
import asyncio
import threading
import tempfile

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from rag.vector_store import aget_doc_store
from backend.utils import s3_storage

BATCH_SIZE = 20

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)


def _set_doc_status(doc_id: str, status: str, error: str | None = None) -> None:
    """Update document processing status in the DB."""
    try:
        from backend.db.database import get_conn
        with get_conn() as conn:
            cur = conn.cursor()
            if error:
                cur.execute(
                    "UPDATE documents SET status=%s, processing_error=%s WHERE id=%s",
                    (status, error[:500], doc_id),
                )
            else:
                cur.execute(
                    "UPDATE documents SET status=%s WHERE id=%s",
                    (status, doc_id),
                )
            cur.close()
    except Exception as exc:
        print(f"[case_index] Failed to set doc status: {exc}")


async def _aindex_case_document(
    user_id: str, case_id: str, doc_id: str, s3_key: str, filename: str
) -> None:
    """Async: download PDF from S3, chunk it, and upsert into DOCUMENT_VECTOR_DB."""
    _set_doc_status(doc_id, "processing")

    try:
        import fitz
    except ImportError:
        _set_doc_status(doc_id, "error", "PyMuPDF not installed")
        print("PyMuPDF not installed — skipping indexing.")
        return

    # Download PDF bytes from S3
    try:
        pdf_bytes = s3_storage.download_pdf(s3_key)
    except FileNotFoundError:
        _set_doc_status(doc_id, "error", f"S3 key not found: {s3_key}")
        return
    except Exception as exc:
        _set_doc_status(doc_id, "error", str(exc))
        return

    # Write to temp file so PyMuPDF can open it
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        temp_path = tmp.name

    try:
        doc = fitz.open(temp_path)
        txt = ""
        for i in range(len(doc)):
            txt += doc.get_page_text(i)
        doc.close()
    except Exception as exc:
        _set_doc_status(doc_id, "error", f"PDF parse error: {exc}")
        return
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not txt.strip():
        _set_doc_status(doc_id, "error", "No extractable text found in PDF")
        return

    source_name = os.path.splitext(filename)[0]
    raw = Document(
        page_content=txt,
        metadata={
            "document_id": doc_id,
            "case_id": case_id,
            "user_id": user_id,
            "source": source_name,
            "file_name": filename,
            "s3_key": s3_key,
            "scope": "case",
        },
    )

    chunks = splitter.split_documents([raw])
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_id"] = str(uuid.uuid4())
        chunk.metadata["chunk_index"] = i + 1
        # Ensure document_id + case_id are on every chunk for filtering
        chunk.metadata["document_id"] = doc_id
        chunk.metadata["case_id"] = case_id

    try:
        store = await aget_doc_store()
        for i in range(0, len(chunks), BATCH_SIZE):
            batch = chunks[i : i + BATCH_SIZE]
            await store.aadd_documents(batch)
    except Exception as exc:
        _set_doc_status(doc_id, "error", f"Vector indexing failed: {exc}")
        return

    _set_doc_status(doc_id, "completed")


def index_case_document(
    user_id: str, case_id: str, doc_id: str, s3_key: str, filename: str
) -> None:
    """Sync wrapper — called from workspace_service after uploading a PDF to S3.

    Runs the async indexing in a background thread with its own event loop so
    it never conflicts with FastAPI's already-running event loop.
    """

    def _run_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                _aindex_case_document(user_id, case_id, doc_id, s3_key, filename)
            )
        finally:
            loop.close()

    thread = threading.Thread(target=_run_in_thread, daemon=True)
    thread.start()
