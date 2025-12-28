from fastapi import Depends, Header
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.core.errors import auth_required, auth_invalid_credentials
from app.models.user import User


def get_token_header(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise auth_required()
    return authorization.split(" ", 1)[1]


def get_current_user(db: Session = Depends(get_db), token: str = Depends(get_token_header)) -> User:
    try:
        payload = decode_access_token(token)
        uid = payload.get("sub")
    except Exception:
        raise auth_invalid_credentials()
    if not uid:
        raise auth_invalid_credentials()
    user = db.query(User).filter(User.id == int(uid), User.is_active == True).first()  # noqa: E712
    if not user:
        raise auth_invalid_credentials()
    return user


def get_optional_user(
    db: Session = Depends(get_db), authorization: str | None = Header(default=None)
) -> User | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_access_token(token)
        uid = payload.get("sub")
    except Exception:
        return None
    if not uid:
        return None
    return db.query(User).filter(User.id == int(uid), User.is_active == True).first()  # noqa: E712
