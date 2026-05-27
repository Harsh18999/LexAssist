from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.services.auth_service import decode_token, get_user

security = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
):
    if not creds or not creds.credentials:
        raise HTTPException(401, "Authentication required")
    user_id = decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(401, "Invalid or expired token")
    user = get_user(user_id)
    if not user:
        raise HTTPException(401, "User not found")
    return user
