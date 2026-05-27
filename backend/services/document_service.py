import os
from datetime import datetime

import fitz

DATA_DIR = "Data"
CHROMA_PATH = "Data/Processed/chroma_db"

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


def detect_category(filename):
    name = filename.lower().replace("_", " ")
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(kw in name for kw in keywords):
            return category
    return "general"


def index_status():
    exists = os.path.exists(CHROMA_PATH)
    sqlite = os.path.join(CHROMA_PATH, "chroma.sqlite3")
    if exists and os.path.isfile(sqlite):
        return "Active"
    if exists:
        return "Active"
    return "Not Built"


def _format_size(size_bytes):
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024, 1)} KB"
    return f"{round(size_bytes / (1024 * 1024), 1)} MB"


def list_documents(search=""):
    docs = []
    if not os.path.isdir(DATA_DIR):
        return docs

    for root, _, files in os.walk(DATA_DIR):
        if "Processed" in root.replace("\\", "/"):
            continue
        for name in files:
            if not name.lower().endswith(".pdf"):
                continue
            if search and search.lower() not in name.lower():
                continue

            full_path = os.path.join(root, name)
            stat = os.stat(full_path)
            rel = os.path.relpath(full_path, DATA_DIR)

            docs.append(
                {
                    "filename": name,
                    "path": rel.replace("\\", "/"),
                    "full_path": full_path,
                    "upload_date": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "size_bytes": stat.st_size,
                    "size_label": _format_size(stat.st_size),
                    "category": detect_category(name),
                }
            )

    docs.sort(key=lambda d: d["upload_date"], reverse=True)
    return docs


def get_document_preview(rel_path):
    full_path = os.path.join(DATA_DIR, rel_path.replace("/", os.sep))
    if not os.path.isfile(full_path):
        return None

    stat = os.stat(full_path)
    doc = fitz.open(full_path)
    page_count = len(doc)
    first_page = doc[0].get_text()[:1200] if page_count > 0 else ""
    snippet = ""
    for page_num in range(min(3, page_count)):
        snippet += doc[page_num].get_text()
    doc.close()
    snippet = " ".join(snippet.split())[:800]

    return {
        "filename": os.path.basename(full_path),
        "path": rel_path,
        "upload_date": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "size_label": _format_size(stat.st_size),
        "category": detect_category(os.path.basename(full_path)),
        "first_page_text": first_page.strip(),
        "snippet": snippet,
        "page_count": page_count,
    }
