import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.core.response import ok
from app.core.errors import auth_invalid_credentials, AppError
from app.core.security import create_access_token, verify_password, hash_password, validate_password_strength
from app.schemas.auth import LoginIn, ChangePasswordIn
from app.api.deps import get_current_user
from app.models.user import User
import logging

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = logging.getLogger(__name__)

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 5
_login_attempts: dict[str, list[float]] = {}


@router.post("/login")
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    # simple IP-based rate limit
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    attempts = _login_attempts.get(ip, [])
    attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
    if len(attempts) >= RATE_LIMIT_MAX:
        wait = max(1, int(RATE_LIMIT_WINDOW - (now - attempts[0])))
        raise AppError(code="RATE_LIMIT", message=f"登录过于频繁，请在{wait}秒后再试", status_code=429)

    u = (
        db.query(User)
        .filter(func.lower(User.username) == payload.username.lower(), User.is_active == True)  # noqa: E712
        .first()
    )
    if not u or not verify_password(payload.password, u.password_hash):
        attempts.append(now)
        _login_attempts[ip] = attempts
        raise auth_invalid_credentials()
    _login_attempts[ip] = attempts  # reset to trimmed list on success
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
            "group_id": user.group_id,
            "major_id": user.major_id,
            "is_active": user.is_active,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
    )


@router.post("/change-password")
def change_password(
    payload: ChangePasswordIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.old_password, user.password_hash):
        raise AppError(code="AUTH_INVALID_CREDENTIALS", message="原密码不正确", status_code=400)
    if not validate_password_strength(payload.new_password):
        raise AppError(code="VALIDATION_ERROR", message="新密码不符合复杂度要求（至少8位，含大小写和数字）", status_code=400)
    user.password_hash = hash_password(payload.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    db.commit()
    logger.info("User %s changed password", user.username)
    return ok(request, {"status": "ok"})
