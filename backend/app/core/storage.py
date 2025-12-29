import os
import hashlib
from typing import Optional
import tempfile
import oss2
from app.core.config import settings


def is_oss_enabled() -> bool:
    return (
        settings.STORAGE_BACKEND.lower() == "oss"
        and settings.OSS_ENDPOINT
        and settings.OSS_BUCKET
        and settings.OSS_ACCESS_KEY
        and settings.OSS_SECRET
    )


_oss_bucket = None


def _get_oss_bucket():
    global _oss_bucket
    if _oss_bucket is None:
        auth = oss2.Auth(settings.OSS_ACCESS_KEY, settings.OSS_SECRET)
        _oss_bucket = oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET)
    return _oss_bucket


def save_file_local(file_obj, storage_path: str, max_bytes: int) -> tuple[int, str]:
    sha = hashlib.sha256()
    size = 0
    os.makedirs(os.path.dirname(storage_path), exist_ok=True)
    with open(storage_path, "wb") as f:
        while True:
            chunk = file_obj.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                try:
                    os.remove(storage_path)
                except Exception:
                    pass
                raise ValueError("FILE_TOO_LARGE")
            sha.update(chunk)
            f.write(chunk)
    return size, sha.hexdigest()


def save_file_oss(file_obj, key: str) -> tuple[int, str]:
    data = file_obj.read()
    size = len(data)
    sha = hashlib.sha256(data).hexdigest()
    bucket = _get_oss_bucket()
    bucket.put_object(key, data)
    return size, sha


def generate_oss_signed_url(key: str, expires: int) -> str:
    bucket = _get_oss_bucket()
    url = bucket.sign_url("GET", key, expires)
    return url


def build_oss_url(key: str) -> str:
    if settings.OSS_BASE_URL:
        return f"{settings.OSS_BASE_URL.rstrip('/')}/{key}"
    bucket = _get_oss_bucket()
    return f"https://{bucket.bucket_name}.{bucket.endpoint.replace('http://', '').replace('https://', '')}/{key}"


def download_oss_to_temp(key: str) -> str:
    bucket = _get_oss_bucket()
    tmp = tempfile.NamedTemporaryFile(delete=False)
    tmp_path = tmp.name
    tmp.close()
    bucket.get_object_to_file(key, tmp_path)
    return tmp_path
