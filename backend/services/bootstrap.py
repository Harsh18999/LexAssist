"""One-time sync of existing Data PDFs into recent_uploads if empty."""
import os

from backend.services.document_service import list_documents, detect_category
from backend.services.recent_uploads import get_recent_uploads, add_recent_upload


def sync_existing_documents():
    if get_recent_uploads(1):
        return
    for doc in list_documents()[:20]:
        add_recent_upload(
            doc["filename"],
            doc.get("size_bytes", 0),
            doc.get("category", detect_category(doc["filename"])),
        )
