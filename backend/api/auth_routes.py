from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from backend.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
def register(req: RegisterRequest):
    try:
        user = auth_service.register(req.email, req.password, req.name)
        token = auth_service.create_token(user["id"])
        return {"user": user, "token": token}
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/login")
def login(req: LoginRequest):
    try:
        user = auth_service.login(req.email, req.password)
        token = auth_service.create_token(user["id"])
        return {
            "user": {"id": user["id"], "email": user["email"], "name": user["name"]},
            "token": token,
        }
    except ValueError as e:
        raise HTTPException(401, str(e)) from e
