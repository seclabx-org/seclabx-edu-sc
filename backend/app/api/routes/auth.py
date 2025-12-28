from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.core.response import ok
from app.core.errors import auth_invalid_credentials
from app.core.security import create_access_token, verify_password
from app.schemas.auth import LoginIn
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    u = (
        db.query(User)
        .filter(func.lower(User.username) == payload.username.lower(), User.is_active == True)  # noqa: E712
        .first()
    )
    if not u or not verify_password(payload.password, u.password_hash):
        raise auth_invalid_credentials()
    u.last_login_at = func.now()
    db.commit()
    token = create_access_token({"id": u.id, "role": u.role})
    from app.core.config import settings

    return ok(
        request,
        {"access_token": token, "token_type": "Bearer", "expires_in": settings.ACCESS_TOKEN_EXPIRES_SECONDS},
    )


@router.get("/me")
def me(request: Request, user: User = Depends(get_current_user)):
    return ok(
        request,
        {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "major_id": user.major_id,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
    )
