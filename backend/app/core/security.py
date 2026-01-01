import hashlib
import hmac
import time
import jwt
import re
import secrets
from passlib.context import CryptContext
from .config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: dict, expires_in_seconds: int | None = None) -> str:
    """
    subject: {"id": int, "role": str}
    PyJWT requires `sub` to be a string, so we keep `role` as a separate claim.
    """
    now = int(time.time())
    exp = now + int(expires_in_seconds or settings.ACCESS_TOKEN_EXPIRES_SECONDS)
    payload = {"sub": str(subject.get("id")), "role": subject.get("role"), "exp": exp, "iat": now}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALG])


def sign_download(file_id: str, exp_ts: int, user_id: int | None = None) -> str:
    msg = f"{file_id}.{exp_ts}.{user_id or ''}".encode("utf-8")
    sig = hmac.new(settings.SIGNED_URL_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    return sig


def verify_download_signature(file_id: str, exp_ts: int, sig: str, user_id: int | None = None) -> bool:
    if int(time.time()) > int(exp_ts):
        return False
    expected = sign_download(file_id, exp_ts, user_id)
    return hmac.compare_digest(expected, sig)


def validate_password_strength(password: str) -> bool:
    """
    简单密码强度校验：至少8位，包含大小写字母和数字，建议包含特殊字符。
    """
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"[a-z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    return True


def generate_strong_password(length: int = 12) -> str:
    """
    生成包含大小写、数字的随机密码，长度可配置，默认12位。
    """
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+"
    pwd = "".join(secrets.choice(alphabet) for _ in range(length))
    if validate_password_strength(pwd):
        return pwd
    # 如未满足强度，递归重试（概率极低）
    return generate_strong_password(length)
