import json
import uuid
from datetime import datetime, timezone

from backend.db.database import get_conn, row_to_dict


def _now():
    return datetime.now(timezone.utc).isoformat()


def _parse_case(row):
    c = row_to_dict(row)
    if c and c.get("brief_json"):
        try:
            c["brief"] = json.loads(c["brief_json"])
        except json.JSONDecodeError:
            c["brief"] = None
    return c


def list_cases(user_id: str, search: str = "", client_id: str = None):
    """List cases with optional SQL-level ILIKE search (no Python post-filter)."""
    params = [user_id]
    filters = ["c.user_id = %s"]

    if client_id:
        filters.append("c.client_id = %s")
        params.append(client_id)

    if search:
        filters.append(
            "(c.title ILIKE %s OR c.case_number ILIKE %s OR cl.name ILIKE %s)"
        )
        like = f"%{search}%"
        params.extend([like, like, like])

    where = " AND ".join(filters)
    q = f"""
        SELECT c.*, cl.name AS client_name
        FROM cases c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE {where}
        ORDER BY c.updated_at DESC
    """
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(q, params)
        rows = cur.fetchall()
        cur.close()
    return [_parse_case(r) for r in rows]


def get_case(user_id: str, case_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT c.*, cl.name as client_name, cl.phone as client_phone
            FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.id = %s AND c.user_id = %s""",
            (case_id, user_id),
        )
        row = cur.fetchone()
        cur.close()
    return _parse_case(row)


def create_case(user_id: str, data: dict):
    cid = str(uuid.uuid4())[:10]
    now = _now()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO cases
            (id, user_id, client_id, title, case_number, court, filing_date, judgment_date,
             case_type, petitioner, respondent, judges, status, acts_involved,
             constitutional_articles, hearing_date, advocate, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (
                cid, user_id, data["client_id"], data.get("title", "Untitled Case"),
                data.get("case_number"), data.get("court"), data.get("filing_date"),
                data.get("judgment_date"), data.get("case_type"),
                data.get("petitioner"), data.get("respondent"), data.get("judges"),
                data.get("status", "Active"), data.get("acts_involved"),
                data.get("constitutional_articles"), data.get("hearing_date"),
                data.get("advocate"), now, now,
            ),
        )
        cur.close()
    return get_case(user_id, cid)


def update_case(user_id: str, case_id: str, data: dict):
    case = get_case(user_id, case_id)
    if not case:
        return None
    fields = [
        "title", "case_number", "court", "filing_date", "judgment_date", "case_type",
        "petitioner", "respondent", "judges", "status", "acts_involved",
        "constitutional_articles", "hearing_date", "advocate",
    ]
    values = [data.get(f, case.get(f)) for f in fields]
    values.extend([_now(), case_id, user_id])
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            f"""UPDATE cases SET {", ".join(f + "=%s" for f in fields)}, updated_at=%s
            WHERE id=%s AND user_id=%s""",
            values,
        )
        cur.close()
    return get_case(user_id, case_id)


def save_brief(user_id: str, case_id: str, brief: dict):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE cases SET brief_json=%s, updated_at=%s WHERE id=%s AND user_id=%s",
            (json.dumps(brief), _now(), case_id, user_id),
        )
        cur.close()
    return get_case(user_id, case_id)


def count_cases(user_id: str, status: str = None):
    with get_conn() as conn:
        cur = conn.cursor()
        if status:
            cur.execute(
                "SELECT COUNT(*) as n FROM cases WHERE user_id=%s AND status=%s",
                (user_id, status),
            )
        else:
            cur.execute(
                "SELECT COUNT(*) as n FROM cases WHERE user_id=%s", (user_id,)
            )
        row = cur.fetchone()
        cur.close()
    return row["n"] if row else 0


def upcoming_hearings(user_id: str, limit=5):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT c.id, c.title, c.hearing_date, c.court, cl.name as client_name
            FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.user_id = %s AND c.hearing_date IS NOT NULL AND c.hearing_date != ''
            ORDER BY c.hearing_date ASC LIMIT %s""",
            (user_id, limit),
        )
        rows = cur.fetchall()
        cur.close()
    return [row_to_dict(r) for r in rows]
