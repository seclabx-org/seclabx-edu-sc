import hashlib
import hmac
import time
import jwt
from passlib.context import CryptContext
from .config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: dict, expires_in_seconds: int | None = None) -> str:
    exp = int(time.time()) + int(expires_in_seconds or settings.ACCESS_TOKEN_EXPIRES_SECONDS)
    payload = {"sub": subject, "exp": exp}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])


def sign_download(file_id: str, exp_ts: int) -> str:
    msg = f"{file_id}.{exp_ts}".encode("utf-8")
    sig = hmac.new(settings.SIGNED_URL_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return sig


def verify_download_signature(file_id: str, exp_ts: int, sig: str) -> bool:
    if int(time.time()) > int(exp_ts):
        return False
    expected = sign_download(file_id, exp_ts)
    return hmac.compare_digest(expected, sig)
