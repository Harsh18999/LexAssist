from backend.utils.storage import read_json, write_json, now_iso

UPLOADS_FILE = "recent_uploads.json"


def get_recent_uploads(limit=5):
    data = read_json(UPLOADS_FILE, {"uploads": []})
    return data.get("uploads", [])[:limit]


def add_recent_upload(filename, size_bytes=0, category="general"):
    data = read_json(UPLOADS_FILE, {"uploads": []})
    uploads = data.get("uploads", [])

    uploads = [u for u in uploads if u.get("filename") != filename]
    uploads.insert(
        0,
        {
            "filename": filename,
            "uploaded_at": now_iso(),
            "size_bytes": size_bytes,
            "category": category,
        },
    )
    data["uploads"] = uploads[:50]
    write_json(UPLOADS_FILE, data)
