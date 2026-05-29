import os
import sys
import asyncio
import subprocess
from datetime import datetime, timezone

from backend.services.activity_service import log_activity
from backend.services.stats_service import set_last_indexed

PG_VECTOR_TABLE = "LEGAL_VECTOR_DB"


def rebuild_index(user_id: str) -> dict:
    """Truncate LEGAL_VECTOR_DB and re-index all documents via build_index.py."""
    # Truncate the vector table so we start fresh
    try:
        from backend.db.database import get_conn
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(f'TRUNCATE TABLE "{PG_VECTOR_TABLE}"')
            cur.close()
    except Exception:
        pass  # Table may not exist yet on first run

    rag_dir = os.path.join(os.getcwd(), "rag")
    result = subprocess.run(
        [os.environ.get("PYTHON", sys.executable), "build_index.py"],
        capture_output=True,
        text=True,
        cwd=rag_dir,
    )

    ts = datetime.now(timezone.utc).isoformat()
    set_last_indexed(user_id, ts)
    log_activity(user_id, "AI Index Rebuilt", "LEGAL_VECTOR_DB refreshed")

    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
