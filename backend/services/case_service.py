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
    q = "SELECT c.*, cl.name as client_name FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id WHERE c.user_id = ?"
    params = [user_id]
    if client_id:
        q += " AND c.client_id = ?"
        params.append(client_id)
    q += " ORDER BY c.updated_at DESC"
    with get_conn() as conn:
        rows = conn.execute(q, params).fetchall()
    cases = [_parse_case(r) for r in rows]
    if search:
        s = search.lower()
        cases = [
            x for x in cases
            if s in (x.get("title") or "").lower()
            or s in (x.get("case_number") or "").lower()
            or s in (x.get("client_name") or "").lower()
        ]
    return cases


def get_case(user_id: str, case_id: str):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT c.*, cl.name as client_name, cl.phone as client_phone
            FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.id = ? AND c.user_id = ?""",
            (case_id, user_id),
        ).fetchone()
    return _parse_case(row)


def create_case(user_id: str, data: dict):
    cid = str(uuid.uuid4())[:10]
    now = _now()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO cases
            (id, user_id, client_id, title, case_number, court, filing_date, judgment_date,
             case_type, petitioner, respondent, judges, status, acts_involved,
             constitutional_articles, hearing_date, advocate, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
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
        conn.execute(
            f"""UPDATE cases SET {", ".join(f + "=?" for f in fields)}, updated_at=?
            WHERE id=? AND user_id=?""",
            values,
        )
    return get_case(user_id, case_id)


def save_brief(user_id: str, case_id: str, brief: dict):
    with get_conn() as conn:
        conn.execute(
            "UPDATE cases SET brief_json=?, updated_at=? WHERE id=? AND user_id=?",
            (json.dumps(brief), _now(), case_id, user_id),
        )
    return get_case(user_id, case_id)


def count_cases(user_id: str, status: str = None):
    with get_conn() as conn:
        if status:
            row = conn.execute(
                "SELECT COUNT(*) as n FROM cases WHERE user_id=? AND status=?",
                (user_id, status),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT COUNT(*) as n FROM cases WHERE user_id=?", (user_id,)
            ).fetchone()
    return row["n"] if row else 0


def upcoming_hearings(user_id: str, limit=5):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT c.id, c.title, c.hearing_date, c.court, cl.name as client_name
            FROM cases c LEFT JOIN clients cl ON c.client_id = cl.id
            WHERE c.user_id = ? AND c.hearing_date IS NOT NULL AND c.hearing_date != ''
            ORDER BY c.hearing_date ASC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
    return [row_to_dict(r) for r in rows]
