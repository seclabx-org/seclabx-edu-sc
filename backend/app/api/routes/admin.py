from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, date
from collections import deque
from pathlib import Path
from app.db.session import get_db
from app.core.response import ok, created
from app.core.rbac import require_roles
from app.core.security import hash_password, validate_password_strength, generate_strong_password
from app.core.errors import AppError
from app.core.config import settings
from app.models.user import User
from app.models.resource import Resource
from app.schemas.admin import AdminUserCreateIn, AdminUserPatchIn, AdminResetPasswordOut
import logging

logger = logging.getLogger(__name__)

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
        raise AppError(code="RESOURCE_CONFLICT", message="用户名已存在", status_code=409)

    initial_pwd = payload.initial_password or generate_strong_password()
    if not validate_password_strength(initial_pwd):
        raise AppError(code="VALIDATION_ERROR", message="初始密码不符合复杂度要求（至少8位，包含大小写和数字）", status_code=400)

    u = User(
        username=payload.username,
        name=payload.name,
        role=payload.role,
        major_id=payload.major_id,
        password_hash=hash_password(initial_pwd),
        is_active=True,
    )
    db.add(u)
    db.commit()
    logger.info("Admin %s created user %s", admin.username, u.username)
    return created(request, {"id": u.id, "initial_password": initial_pwd})


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
        raise AppError(code="RESOURCE_NOT_FOUND", message="用户不存在", status_code=404)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    logger.info("Admin %s patched user %s", admin.username, u.username)
    return ok(request, {"id": u.id})


@router.post("/users/{uid}/reset-password", response_model=AdminResetPasswordOut)
def reset_password(
    uid: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
):
    u = db.query(User).filter(User.id == uid).first()
    if not u:
        raise AppError(code="RESOURCE_NOT_FOUND", message="用户不存在", status_code=404)
    new_pwd = generate_strong_password()
    u.password_hash = hash_password(new_pwd)
    db.commit()
    logger.warning("Admin %s reset password for user %s", admin.username, u.username)
    return AdminResetPasswordOut(id=u.id, username=u.username, new_password=new_pwd)


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


@router.get("/logs")
def read_logs(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
    date_str: str | None = None,
    level: str | None = None,
    keyword: str | None = None,
    max_lines: int = 200,
):
    """
    轻量日志查看：按天文件 + 关键字/级别过滤 + 行数上限。
    文件命名：app.log（当日）、app.log.YYYY-MM-DD（历史）。
    """
    log_dir = Path(settings.LOG_DIR)
    log_dir.mkdir(parents=True, exist_ok=True)
    max_lines = max(10, min(max_lines, 1000))

    # 选定日期文件
    target_date: date | None = None
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise AppError(code="VALIDATION_ERROR", message="date_str 格式应为 YYYY-MM-DD", status_code=400)

    today = datetime.now().date()
    if target_date and target_date < today:
        fname = f"app.log.{target_date.isoformat()}"
    else:
        # 当日或未指定日期 -> 当前日志文件
        fname = "app.log"

    path = log_dir / fname
    if not path.exists():
        raise AppError(code="NOT_FOUND", message="日志文件不存在或已清理", status_code=404)

    # 读取并过滤
    result: deque[str] = deque(maxlen=max_lines)
    level_upper = level.upper() if level else None
    kw = keyword or ""
    try:
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                if level_upper and f"[{level_upper}]" not in line:
                    continue
                if kw and kw not in line:
                    continue
                result.append(line.rstrip("\n"))
    except UnicodeDecodeError:
        raise AppError(code="READ_ERROR", message="日志文件编码异常，读取失败", status_code=500)

    logger.info("Admin %s viewed logs file=%s lines=%s", admin.username, fname, len(result))
    return ok(
        request,
        {
            "file": fname,
            "count": len(result),
            "max_lines": max_lines,
            "level": level_upper,
            "keyword": kw or None,
            "items": list(result),
        },
    )
