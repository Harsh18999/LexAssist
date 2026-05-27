import json

from backend.db.database import get_conn
from backend.services import (
    activity_service,
    case_service,
    client_service,
    workspace_service,
)
from backend.services.document_service import index_status
from backend.services.stats_service import get_user_stats


def get_dashboard(user_id: str):
    stats = get_user_stats(user_id)
    with get_conn() as conn:
        brief_count = conn.execute(
            "SELECT COUNT(*) as n FROM cases WHERE user_id=? AND brief_json IS NOT NULL AND brief_json != ''",
            (user_id,),
        ).fetchone()["n"]

    return {
        "total_clients": client_service.count_clients(user_id),
        "total_cases": case_service.count_cases(user_id),
        "active_cases": case_service.count_cases(user_id, "Active"),
        "uploaded_documents": workspace_service.count_documents(user_id),
        "ai_queries": stats.get("ai_queries", 0),
        "pending_hearings": case_service.count_cases(user_id, "Hearing"),
        "recent_briefs": brief_count,
        "recent_activity": activity_service.get_activities(user_id, 8),
        "upcoming_hearings": case_service.upcoming_hearings(user_id, 5),
        "index_status": index_status(),
        "last_indexed": stats.get("last_indexed"),
    }
