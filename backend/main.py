import os
import sys
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.api.auth_routes import router as auth_router
from backend.api.routes import router
from backend.middleware.latency import LatencyMiddleware

app = FastAPI(
    title="LexAssist API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# ── Middleware (order matters: first added = outermost) ──────────────────────
# app.add_middleware(LatencyMiddleware)          # stamp X-Response-Time on every call
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Response-Time", "X-Total-Count"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(router, prefix="/api")


@app.on_event("startup")
async def on_startup():
    from backend.db.database import init_db
    init_db()
    # Initialise DOCUMENT_VECTOR_DB table (case-uploaded document embeddings)
    try:
        from rag.vector_store import ainit_doc_table
        await ainit_doc_table()
    except Exception as exc:
        print(f"[startup] DOCUMENT_VECTOR_DB init warning: {exc}")


@app.get("/")
def health():
    return {"status": "ok", "service": "JurisAI", "version": "2.0"}


