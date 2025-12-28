import hashlib
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, File, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.response import ok, created, no_content
from app.core.errors import validation_error, not_found, permission_denied, AppError
from app.core.security import sign_download
from app.api.deps import get_current_user, get_optional_user
from app.models.meta import ProfessionalGroup, Major, Course, IdeologyTag
from app.models.resource import Resource, resource_tags
from app.models.download import DownloadLog
from app.models.user import User
from app.schemas.resource import ResourceCreateIn, ResourcePatchIn

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])


def _safe_filename(name: str) -> str:
    cleaned = name.replace("\\", "_").replace("/", "_").replace("..", "_")
    return cleaned.strip() or "file"


def _allowed_exts() -> set[str]:
    return {x.strip().lower() for x in settings.ALLOWED_FILE_EXT.split(",") if x.strip()}


def _calc_can_download(user: User, r: Resource) -> bool:
    if r.source_type == "url":
        return True
    if r.status == "published":
        return True
    if user.role == "admin":
        return True
    if user.role == "teacher" and r.owner_user_id == user.id:
        return True
    return False


def _calc_can_edit(user: User, r: Resource) -> bool:
    if user.role == "admin":
        return True
    if user.role == "teacher" and r.owner_user_id == user.id and r.status == "draft":
        return True
    return False


def _enrich_names(db: Session, r: Resource):
    group = db.query(ProfessionalGroup).filter(ProfessionalGroup.id == r.group_id).first() if r.group_id else None
    major = db.query(Major).filter(Major.id == r.major_id).first() if r.major_id else None
    course = db.query(Course).filter(Course.id == r.course_id).first() if r.course_id else None
    tag_rows = (
        db.query(IdeologyTag)
        .join(resource_tags, resource_tags.c.tag_id == IdeologyTag.id)
        .filter(resource_tags.c.resource_id == r.id)
        .all()
    )
    return {
        "group_name": group.name if group else None,
        "major_name": major.name if major else None,
        "course_name": course.name if course else None,
        "tag_ids": [t.id for t in tag_rows],
        "tag_names": [t.name for t in tag_rows],
    }


@router.get("")
def list_resources(
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
    group_id: int | None = None,
    major_id: int | None = None,
    course_id: int | None = None,
    tag_id: int | None = None,
    keyword: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
    sort: str = "created_at_desc",
):
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    q = db.query(Resource)
    if not user:
        q = q.filter(Resource.status == "published")
    else:
        if user.role != "admin":
            q = q.filter(or_(Resource.status == "published", Resource.owner_user_id == user.id))
        elif status:
            q = q.filter(Resource.status == status)

    if group_id:
        q = q.filter(Resource.group_id == group_id)
    if major_id:
        q = q.filter(Resource.major_id == major_id)
    if course_id:
        q = q.filter(Resource.course_id == course_id)
    if tag_id:
        q = q.join(resource_tags).filter(resource_tags.c.tag_id == tag_id)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(Resource.title.ilike(like), Resource.abstract.ilike(like)))

    total = q.count()

    if sort == "created_at_asc":
        q = q.order_by(Resource.created_at.asc())
    elif sort == "download_desc":
        q = q.order_by(Resource.download_count.desc())
    else:
        q = q.order_by(Resource.created_at.desc())

    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for r in rows:
        names = _enrich_names(db, r)
        base = {
            "id": r.id,
            "title": r.title,
            "abstract": r.abstract,
            "group_id": r.group_id,
            "group_name": names["group_name"],
            "major_id": r.major_id,
            "major_name": names["major_name"],
            "course_id": r.course_id,
            "course_name": names["course_name"],
            "tag_ids": names["tag_ids"],
            "tag_names": names["tag_names"],
            "source_type": r.source_type,
            "file_type": r.file_type,
            "status": r.status,
            "download_count": r.download_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "published_at": r.published_at.isoformat() if r.published_at else None,
        }
        if user:
            base.update(
                {
                    "can_download": _calc_can_download(user, r),
                    "can_edit": _calc_can_edit(user, r),
                    "owner": {"id": r.owner_user_id, "name": None},
                }
            )
        items.append(base)

    return ok(request, {"page": page, "page_size": page_size, "total": total, "items": items})


@router.get("/{rid}")
def get_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()

    if not user:
        if r.status != "published":
            raise not_found()
    else:
        if user.role != "admin" and not (r.status == "published" or r.owner_user_id == user.id):
            raise permission_denied()

    names = _enrich_names(db, r)
    data = {
        "id": r.id,
        "title": r.title,
        "abstract": r.abstract,
        "group_id": r.group_id,
        "group_name": names["group_name"],
        "major_id": r.major_id,
        "major_name": names["major_name"],
        "course_id": r.course_id,
        "course_name": names["course_name"],
        "tag_ids": names["tag_ids"],
        "tag_names": names["tag_names"],
        "source_type": r.source_type,
        "file_type": r.file_type,
        "status": r.status,
        "download_count": r.download_count,
        "owner": {"id": r.owner_user_id, "name": None},
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "published_at": r.published_at.isoformat() if r.published_at else None,
    }

    if user:
        data.update(
            {
                "can_download": _calc_can_download(user, r),
                "can_edit": _calc_can_edit(user, r),
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
        )
        if r.file_id:
            data["file"] = {
                "id": r.file_id,
                "name": r.file_name,
                "size_bytes": r.file_size_bytes,
                "mime": r.file_mime,
                "sha256": r.file_sha256,
            }

    return ok(request, data)


@router.post("")
def create_resource(
    payload: ResourceCreateIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in ("admin", "teacher"):
        raise permission_denied()

    if payload.source_type not in ("upload", "url"):
        raise validation_error("Invalid source_type")
    if payload.source_type == "url":
        if not payload.external_url:
            raise validation_error("external_url is required when source_type=url")
    if payload.source_type == "upload" and payload.external_url:
        raise validation_error("external_url must be null when source_type=upload")

    r = Resource(
        title=payload.title,
        abstract=payload.abstract or "",
        group_id=payload.group_id,
        major_id=payload.major_id,
        course_id=payload.course_id,
        source_type=payload.source_type,
        file_type=payload.file_type,
        external_url=payload.external_url,
        status="draft",
        owner_user_id=user.id,
    )
    db.add(r)
    db.flush()

    for tid in payload.tag_ids or []:
        db.execute(resource_tags.insert().values(resource_id=r.id, tag_id=tid))

    db.commit()
    return created(request, {"id": r.id, "status": r.status, "can_edit": True})


@router.patch("/{rid}")
def patch_resource(
    rid: int,
    payload: ResourcePatchIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()

    if user.role != "admin":
        if not (r.owner_user_id == user.id and r.status == "draft"):
            raise permission_denied()

    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "tag_ids":
            continue
        setattr(r, k, v)
    r.updated_at = datetime.now(timezone.utc)

    if payload.tag_ids is not None:
        db.execute(resource_tags.delete().where(resource_tags.c.resource_id == r.id))
        for tid in payload.tag_ids:
            db.execute(resource_tags.insert().values(resource_id=r.id, tag_id=tid))

    db.commit()
    return ok(request, {"id": r.id, "status": r.status})


@router.post("/{rid}/upload")
def upload_file(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()

    if user.role != "admin" and not (r.owner_user_id == user.id and r.status == "draft"):
        raise permission_denied()

    filename = _safe_filename(file.filename or "file")
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in _allowed_exts():
        raise AppError(code="FILE_TYPE_NOT_ALLOWED", message="File type not allowed.", status_code=415)

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    file_id = f"file_{uuid.uuid4().hex}"
    storage_name = f"{file_id}_{filename}"
    storage_path = os.path.join(settings.UPLOAD_DIR, storage_name)

    sha = hashlib.sha256()
    size = 0
    with open(storage_path, "wb") as f:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > max_bytes:
                try:
                    os.remove(storage_path)
                except Exception:
                    pass
                raise AppError(code="FILE_TOO_LARGE", message="File too large.", status_code=413)
            sha.update(chunk)
            f.write(chunk)

    r.file_id = file_id
    r.file_name = filename
    r.file_size_bytes = size
    r.file_mime = file.content_type
    r.file_sha256 = sha.hexdigest()
    db.commit()

    return ok(
        request,
        {
            "file": {
                "id": r.file_id,
                "name": r.file_name,
                "size_bytes": r.file_size_bytes,
                "mime": r.file_mime,
                "sha256": r.file_sha256,
            },
            "status": r.status,
        },
    )


@router.post("/{rid}/submit")
def submit_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()
    if user.role != "admin" and r.owner_user_id != user.id:
        raise permission_denied()
    r.status = "pending"
    db.commit()
    return ok(request, {"id": r.id, "status": r.status})


@router.post("/{rid}/publish")
def publish_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(__import__("app.core.rbac", fromlist=["require_roles"]).require_roles("admin")),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()
    r.status = "published"
    r.published_at = datetime.now(timezone.utc)
    db.commit()
    return ok(request, {"id": r.id, "status": r.status, "published_at": r.published_at.isoformat()})


@router.post("/{rid}/archive")
def archive_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(__import__("app.core.rbac", fromlist=["require_roles"]).require_roles("admin")),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()
    r.status = "archived"
    db.commit()
    return ok(request, {"id": r.id, "status": r.status})


@router.delete("/{rid}")
def delete_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()

    if user.role == "admin":
        pass
    else:
        if not (user.role == "teacher" and r.owner_user_id == user.id and r.status == "draft"):
            raise permission_denied()

    db.execute(resource_tags.delete().where(resource_tags.c.resource_id == r.id))
    db.delete(r)
    db.commit()
    return no_content()


@router.get("/{rid}/download")
def download_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid).first()
    if not r:
        raise not_found()
    if not _calc_can_download(user, r):
        raise permission_denied()
    if r.source_type == "url":
        return ok(request, {"download_url": r.external_url, "expires_in": settings.SIGNED_URL_EXPIRES_SECONDS})
    if not r.file_id:
        raise not_found()

    exp_ts = int(datetime.now(timezone.utc).timestamp()) + settings.SIGNED_URL_EXPIRES_SECONDS
    sig = sign_download(r.file_id, exp_ts)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    db.add(DownloadLog(resource_id=r.id, user_id=user.id, ip=ip, user_agent=ua))
    r.download_count = (r.download_count or 0) + 1
    db.commit()

    base = str(request.base_url).rstrip("/")
    download_url = f"{base}/api/v1/files/signed/{r.file_id}?exp={exp_ts}&sig={sig}"
    return ok(request, {"download_url": download_url, "expires_in": settings.SIGNED_URL_EXPIRES_SECONDS})
