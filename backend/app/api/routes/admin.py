from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.db.session import get_db
from app.core.response import ok, created
from app.core.rbac import require_roles
from app.core.security import hash_password
from app.core.errors import AppError
from app.models.user import User
from app.models.resource import Resource
from app.schemas.admin import AdminUserCreateIn, AdminUserPatchIn

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/users")
def list_users(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
    page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
):
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    q = db.query(User)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(User.username.ilike(like), User.name.ilike(like)))
    total = q.count()
    items = q.order_by(User.id.asc()).offset((page - 1) * page_size).limit(page_size).all()

    data = []
    for u in items:
        data.append(
            {
                "id": u.id,
                "username": u.username,
                "name": u.name,
                "role": u.role,
                "major_id": u.major_id,
                "is_active": u.is_active,
            }
        )
    return ok(request, {"page": page, "page_size": page_size, "total": total, "items": data})


@router.post("/users")
def create_user(
    payload: AdminUserCreateIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    exists = db.query(User).filter(func.lower(User.username) == payload.username.lower()).first()
    if exists:
        raise AppError(code="RESOURCE_CONFLICT", message="Username already exists.", status_code=409)

    u = User(
        username=payload.username,
        name=payload.name,
        role=payload.role,
        major_id=payload.major_id,
        password_hash=hash_password(payload.initial_password),
        is_active=True,
    )
    db.add(u)
    db.commit()
    return created(request, {"id": u.id})


@router.patch("/users/{uid}")
def patch_user(
    uid: int,
    payload: AdminUserPatchIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    u = db.query(User).filter(User.id == uid).first()
    if not u:
        raise AppError(code="RESOURCE_NOT_FOUND", message="User not found.", status_code=404)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    return ok(request, {"id": u.id})


@router.get("/reports/resources")
def report_resources(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    rows = db.query(Resource).order_by(Resource.id.asc()).limit(200).all()
    items = []
    for r in rows:
        items.append(
            {
                "id": r.id,
                "title": r.title,
                "major_name": None,
                "course_name": None,
                "tag_names": [],
                "status": r.status,
                "download_count": r.download_count,
                "owner_name": None,
                "published_at": r.published_at.isoformat() if r.published_at else None,
            }
        )
    return ok(request, {"items": items})
