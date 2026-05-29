import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from backend.db.database import get_conn, row_to_dict

SECRET = os.getenv("JURISAI_SECRET", "jurisai-dev-secret-change-in-production")
ALGORITHM = "HS256"
TOKEN_HOURS = 72


def _now():
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


def register(email: str, password: str, name: str):
    email = email.strip().lower()
    user_id = str(uuid.uuid4())[:12]
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            cur.close()
            raise ValueError("Email already registered")
        cur.execute(
            "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (%s, %s, %s, %s, %s)",
            (user_id, email, hash_password(password), name.strip(), _now()),
        )
        cur.execute(
            "INSERT INTO user_stats (user_id) VALUES (%s)",
            (user_id,),
        )
        cur.close()
    return get_user(user_id)


def login(email: str, password: str):
    email = email.strip().lower()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cur.fetchone()
        cur.close()
    if not row or not verify_password(password, row["password_hash"]):
        raise ValueError("Invalid email or password")
    return row_to_dict(row)


def get_user(user_id: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id, email, name, created_at FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        cur.close()
    return row_to_dict(row)
