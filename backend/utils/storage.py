import json
import os
from datetime import datetime, timezone

STORAGE_DIR = "storage"


def _ensure_storage():
    os.makedirs(STORAGE_DIR, exist_ok=True)


def _path(name):
    _ensure_storage()
    return os.path.join(STORAGE_DIR, name)


def read_json(name, default=None):
    path = _path(name)
    if not os.path.exists(path):
        return default if default is not None else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(name, data):
    path = _path(name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat()
