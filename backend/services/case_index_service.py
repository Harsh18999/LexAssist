import os
import uuid
import asyncio
import threading
import tempfile

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from rag.vector_store import aget_store
from backend.utils import s3_storage

BATCH_SIZE = 20

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)


async def _aindex_case_document(
    user_id: str, case_id: str, s3_key: str, filename: str
) -> None:
    """Async: download PDF from S3, chunk it, and upsert into the shared LEGAL_VECTOR_DB store."""
    try:
        import fitz
    except ImportError:
        print("PyMuPDF not installed — skipping indexing.")
        return

    # Download PDF bytes from S3
    try:
        pdf_bytes = s3_storage.download_pdf(s3_key)
    except FileNotFoundError:
        print(f"S3 key not found for indexing: {s3_key}")
        return
    except Exception as exc:
        print(f"Failed to download from S3 for indexing: {exc}")
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
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    if not txt.strip():
        return

    source_name = os.path.splitext(filename)[0]
    raw = Document(
        page_content=txt,
        metadata={
            "source": source_name,
            "file_name": filename,
            "s3_key": s3_key,
            "user_id": user_id,
            "case_id": case_id,
            "scope": "case",
        },
    )

    chunks = splitter.split_documents([raw])
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_id"] = str(uuid.uuid4())
        chunk.metadata["chunk_index"] = i + 1

    store = await aget_store()
    for i in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        await store.aadd_documents(batch)


def index_case_document(
    user_id: str, case_id: str, s3_key: str, filename: str
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
                _aindex_case_document(user_id, case_id, s3_key, filename)
            )
        finally:
            loop.close()

    thread = threading.Thread(target=_run_in_thread, daemon=True)
    thread.start()
