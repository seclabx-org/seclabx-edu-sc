import os
from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import verify_download_signature
from app.models.resource import Resource

router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.get("/signed/{file_id}")
def signed_file(file_id: str, exp: int, sig: str, request: Request, db: Session = Depends(get_db)):
    if not verify_download_signature(file_id, int(exp), sig):
        raise AppError(code="AUTH_REQUIRED", message="Signed url invalid or expired.", status_code=401)

    r = db.query(Resource).filter(Resource.file_id == file_id).first()
    if not r or not r.file_name:
        raise AppError(code="RESOURCE_NOT_FOUND", message="File not found.", status_code=404)

    storage_name = f"{file_id}_{r.file_name}"
    path = os.path.join(settings.UPLOAD_DIR, storage_name)
    if not os.path.exists(path):
        raise AppError(code="RESOURCE_NOT_FOUND", message="File missing on server.", status_code=404)

    return FileResponse(path, media_type=r.file_mime or "application/octet-stream", filename=r.file_name)
