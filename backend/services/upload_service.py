import os
import shutil
import subprocess
from datetime import datetime, timezone

from backend.services.activity_service import log_activity
from backend.services.stats_service import set_last_indexed

CHROMA_FOLDER = "Data/Processed/chroma_db"


def rebuild_index(user_id: str):
    if os.path.exists(CHROMA_FOLDER):
        shutil.rmtree(CHROMA_FOLDER)

    rag_dir = os.path.join(os.getcwd(), "rag")
    result = subprocess.run(
        [os.environ.get("PYTHON", "python"), "build_index.py"],
        capture_output=True,
        text=True,
        cwd=rag_dir,
    )

    ts = datetime.now(timezone.utc).isoformat()
    set_last_indexed(user_id, ts)
    log_activity(user_id, "AI Index Rebuilt", "Vector database refreshed")

    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
