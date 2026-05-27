import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.api.auth_routes import router as auth_router
from backend.api.routes import router

app = FastAPI(title="JurisAI API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(router, prefix="/api")


@app.on_event("startup")
def on_startup():
    from backend.db.database import init_db

    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "JurisAI", "version": "2.0"}


frontend_dist = os.path.join(ROOT, "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
