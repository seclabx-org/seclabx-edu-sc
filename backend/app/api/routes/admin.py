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
from app.models.resource import Resource, resource_tags
from app.models.meta import ProfessionalGroup, Major, Course, IdeologyTag
from app.schemas.admin import (
    AdminUserCreateIn,
    AdminUserPatchIn,
    AdminResetPasswordOut,
    GroupCreateIn,
    GroupPatchIn,
    MajorCreateIn,
    MajorPatchIn,
    CourseCreateIn,
    CoursePatchIn,
    TagCreateIn,
    TagPatchIn,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

def _audit(action: str, admin: User, target: User, request: Request, extra: dict | None = None):
    ip = request.client.host if request.client else "unknown"
    logger.info(
        "AUDIT admin=%s action=%s target=%s ip=%s extra=%s",
        admin.username,
        action,
        target.username,
        ip,
        extra or {},
    )


@router.get("/users")
def list_users(
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles("admin")),
    page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    major_id: int | None = None,
    group_id: int | None = None,
):
    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    q = db.query(User)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(User.username.ilike(like), User.name.ilike(like)))
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if major_id:
        q = q.filter(User.major_id == major_id)
    if group_id:
        q = q.filter(User.group_id == group_id)
    total = q.count()
    items = (
        q.order_by(User.last_login_at.desc().nullslast(), User.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    data = []
    for u in items:
        data.append(
            {
                "id": u.id,
                "username": u.username,
                "name": u.name,
                "role": u.role,
                "group_id": u.group_id,
                "major_id": u.major_id,
                "is_active": u.is_active,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
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
        group_id=payload.group_id,
        major_id=payload.major_id,
        password_hash=hash_password(initial_pwd),
        is_active=True,
    )
    db.add(u)
    db.commit()
    _audit("create_user", admin, u, request, {"role": u.role, "major_id": u.major_id})
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
    if u.username == "admin":
        raise AppError(code="FORBIDDEN", message="默认管理员账号禁止修改", status_code=403)

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    _audit("patch_user", admin, u, request, {"fields": list(data.keys())})
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
    if u.username == "admin":
        raise AppError(code="FORBIDDEN", message="默认管理员账号禁止重置密码", status_code=403)
    new_pwd = generate_strong_password()
    u.password_hash = hash_password(new_pwd)
    db.commit()
    _audit("reset_password", admin, u, request)
    return ok(request, AdminResetPasswordOut(id=u.id, username=u.username, new_password=new_pwd).model_dump())


def _res_count_by(db: Session, field, value):
    return (
        db.query(func.count(Resource.id))
        .filter(field == value)
        .scalar()
    )


@router.get("/meta/groups")
def admin_groups(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    rows = db.query(ProfessionalGroup).order_by(ProfessionalGroup.sort_order.asc(), ProfessionalGroup.id.asc()).all()
    data = []
    for g in rows:
        data.append(
            {
                "id": g.id,
                "name": g.name,
                "code": g.code,
                "sort_order": g.sort_order,
                "is_active": g.is_active,
                "resource_count": _res_count_by(db, Resource.group_id, g.id),
            }
        )
    return ok(request, {"items": data})


@router.post("/meta/groups")
def create_group(payload: GroupCreateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    exists = db.query(ProfessionalGroup).filter(func.lower(ProfessionalGroup.name) == payload.name.lower()).first()
    if exists:
        raise AppError(code="RESOURCE_CONFLICT", message="专业群已存在", status_code=409)
    g = ProfessionalGroup(
        name=payload.name,
        code=payload.code,
        sort_order=payload.sort_order or 0,
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(g)
    db.commit()
    return created(request, {"id": g.id})


@router.patch("/meta/groups/{gid}")
def patch_group(gid: int, payload: GroupPatchIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    g = db.query(ProfessionalGroup).filter(ProfessionalGroup.id == gid).first()
    if not g:
        raise AppError(code="RESOURCE_NOT_FOUND", message="专业群不存在", status_code=404)
    data = payload.model_dump(exclude_unset=True)
    if "sort_order" in data and data["sort_order"] is None:
        data.pop("sort_order")
    if "is_active" in data and data["is_active"] is None:
        data.pop("is_active")
    for k, v in data.items():
        setattr(g, k, v)
    db.commit()
    return ok(request, {"id": g.id})


@router.get("/meta/majors")
def admin_majors(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    rows = db.query(Major).order_by(Major.sort_order.asc(), Major.id.asc()).all()
    data = []
    for m in rows:
        data.append(
            {
                "id": m.id,
                "group_id": m.group_id,
                "name": m.name,
                "code": m.code,
                "sort_order": m.sort_order,
                "is_active": m.is_active,
                "resource_count": _res_count_by(db, Resource.major_id, m.id),
            }
        )
    return ok(request, {"items": data})


@router.post("/meta/majors")
def create_major(payload: MajorCreateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    exists = db.query(Major).filter(Major.group_id == payload.group_id, func.lower(Major.name) == payload.name.lower()).first()
    if exists:
        raise AppError(code="RESOURCE_CONFLICT", message="专业已存在", status_code=409)
    m = Major(
        group_id=payload.group_id,
        name=payload.name,
        code=payload.code,
        sort_order=payload.sort_order or 0,
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(m)
    db.commit()
    return created(request, {"id": m.id})


@router.patch("/meta/majors/{mid}")
def patch_major(mid: int, payload: MajorPatchIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    m = db.query(Major).filter(Major.id == mid).first()
    if not m:
        raise AppError(code="RESOURCE_NOT_FOUND", message="专业不存在", status_code=404)
    data = payload.model_dump(exclude_unset=True)
    if "sort_order" in data and data["sort_order"] is None:
        data.pop("sort_order")
    if "is_active" in data and data["is_active"] is None:
        data.pop("is_active")
    for k, v in data.items():
        setattr(m, k, v)
    db.commit()
    return ok(request, {"id": m.id})


@router.get("/meta/courses")
def admin_courses(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    rows = db.query(Course).order_by(Course.sort_order.asc(), Course.id.asc()).all()
    data = []
    for c in rows:
        data.append(
            {
                "id": c.id,
                "major_id": c.major_id,
                "name": c.name,
                "term": c.term,
                "sort_order": c.sort_order,
                "is_active": c.is_active,
                "resource_count": _res_count_by(db, Resource.course_id, c.id),
            }
        )
    return ok(request, {"items": data})


@router.post("/meta/courses")
def create_course(payload: CourseCreateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    exists = (
        db.query(Course)
        .filter(Course.major_id == payload.major_id, func.lower(Course.name) == payload.name.lower())
        .first()
    )
    if exists:
        raise AppError(code="RESOURCE_CONFLICT", message="课程已存在", status_code=409)
    c = Course(
        major_id=payload.major_id,
        name=payload.name,
        term=payload.term,
        sort_order=payload.sort_order or 0,
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(c)
    db.commit()
    return created(request, {"id": c.id})


@router.patch("/meta/courses/{cid}")
def patch_course(cid: int, payload: CoursePatchIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    c = db.query(Course).filter(Course.id == cid).first()
    if not c:
        raise AppError(code="RESOURCE_NOT_FOUND", message="课程不存在", status_code=404)
    data = payload.model_dump(exclude_unset=True)
    if "sort_order" in data and data["sort_order"] is None:
        data.pop("sort_order")
    if "is_active" in data and data["is_active"] is None:
        data.pop("is_active")
    for k, v in data.items():
        setattr(c, k, v)
    db.commit()
    return ok(request, {"id": c.id})


@router.get("/meta/tags")
def admin_tags(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    rows = db.query(IdeologyTag).order_by(IdeologyTag.sort_order.asc(), IdeologyTag.id.asc()).all()
    data = []
    for t in rows:
        count = (
            db.query(func.count(Resource.id))
            .join(resource_tags, resource_tags.c.resource_id == Resource.id)
            .filter(resource_tags.c.tag_id == t.id)
            .scalar()
        )
        data.append(
            {
                "id": t.id,
                "name": t.name,
                "sort_order": t.sort_order,
                "is_active": t.is_active,
                "resource_count": count,
            }
        )
    return ok(request, {"items": data})


@router.post("/meta/tags")
def create_tag(payload: TagCreateIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    exists = db.query(IdeologyTag).filter(func.lower(IdeologyTag.name) == payload.name.lower()).first()
    if exists:
        raise AppError(code="RESOURCE_CONFLICT", message="标签已存在", status_code=409)
    t = IdeologyTag(
        name=payload.name,
        sort_order=payload.sort_order or 0,
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(t)
    db.commit()
    return created(request, {"id": t.id})


@router.patch("/meta/tags/{tid}")
def patch_tag(tid: int, payload: TagPatchIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_roles("admin"))):
    t = db.query(IdeologyTag).filter(IdeologyTag.id == tid).first()
    if not t:
        raise AppError(code="RESOURCE_NOT_FOUND", message="标签不存在", status_code=404)
    data = payload.model_dump(exclude_unset=True)
    if "sort_order" in data and data["sort_order"] is None:
        data.pop("sort_order")
    if "is_active" in data and data["is_active"] is None:
        data.pop("is_active")
    for k, v in data.items():
        setattr(t, k, v)
    db.commit()
    return ok(request, {"id": t.id})


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
