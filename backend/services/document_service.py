import os
import tempfile
from datetime import datetime

import fitz

from backend.utils import s3_storage

PG_VECTOR_TABLE = "data_jurisai_legal_docs"  # LlamaIndex PGVector table name

CATEGORY_KEYWORDS = {
    "constitutional": [
        "constitution", "article", "fundamental", "privacy",
        "kesavananda", "puttaswamy", "maneka", "bommai", "navtej",
    ],
    "criminal": [
        "criminal", "bns", "bnss", "arrest", "ipc", "bail",
        "arnesh", "bachan", "lalita", "basu",
    ],
    "cyber": [
        "cyber", "it act", "digital", "technology", "shreya singhal",
        "information technology",
    ],
    "evidence": ["evidence", "witness", "bsa", "proof"],
    "acts": ["act", "bns", "bnss", "bsa", "constitution_of"],
}


def detect_category(filename: str) -> str:
    name = filename.lower().replace("_", " ")
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return category
    return "general"


def index_status() -> str:
    """Check whether the LEGAL_VECTOR_DB table exists and has rows."""
    try:
        from backend.db.database import get_conn
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT COUNT(*) as n FROM information_schema.tables "
                "WHERE table_name = %s",
                (PG_VECTOR_TABLE,),
            )
            exists = cur.fetchone()["n"] > 0
            count = 0
            if exists:
                cur.execute(f'SELECT COUNT(*) as n FROM "{PG_VECTOR_TABLE}"')
                count = cur.fetchone()["n"]
            cur.close()
        return "Active" if exists and count > 0 else "Not Built"
    except Exception:
        return "Not Built"


def list_documents(search: str = "") -> list[dict]:
    """List all PDF documents stored in S3 under the knowledge_base/ prefix."""
    try:
        objects = s3_storage.list_documents(prefix=s3_storage.FOLDER_KNOWLEDGE)
    except Exception as exc:
        print(f"Failed to list S3 documents: {exc}")
        return []

    docs = []
    for obj in objects:
        filename = obj["filename"]
        if search and search.lower() not in filename.lower():
            continue
        docs.append(
            {
                "filename": filename,
                "path": obj["key"],        # S3 key used as the "path"
                "s3_key": obj["key"],
                "upload_date": obj["last_modified"],
                "size_bytes": obj["size_bytes"],
                "size_label": s3_storage.get_size_label(obj["size_bytes"]),
                "category": detect_category(filename),
            }
        )

    docs.sort(key=lambda d: d["upload_date"], reverse=True)
    return docs


def get_document_preview(s3_key: str) -> dict | None:
    """Download a PDF from S3 and return a text preview."""
    try:
        pdf_bytes = s3_storage.download_pdf(s3_key)
    except FileNotFoundError:
        return None
    except Exception as exc:
        print(f"Failed to download PDF from S3 for preview: {exc}")
        return None

    # Write to tempfile for PyMuPDF
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(pdf_bytes)
        temp_path = tmp.name

    try:
        doc = fitz.open(temp_path)
        page_count = len(doc)
        first_page = doc[0].get_text()[:1200] if page_count > 0 else ""
        snippet = ""
        for page_num in range(min(3, page_count)):
            snippet += doc[page_num].get_text()
        doc.close()
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    snippet = " ".join(snippet.split())[:800]
    filename = s3_key.split("/")[-1]

    return {
        "filename": filename,
        "path": s3_key,
        "s3_key": s3_key,
        "upload_date": datetime.utcnow().isoformat(),
        "size_label": s3_storage.get_size_label(len(pdf_bytes)),
        "category": detect_category(filename),
        "first_page_text": first_page.strip(),
        "snippet": snippet,
        "page_count": page_count,
    }
