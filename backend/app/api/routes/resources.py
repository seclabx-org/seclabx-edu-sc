import hashlib
import os
import uuid
from datetime import datetime, timezone
import subprocess
import tempfile
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, Request, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.response import ok, created, no_content
from app.core.errors import validation_error, not_found, permission_denied, AppError
from app.core.security import sign_download
from app.core.storage import is_oss_enabled, save_file_local, save_file_oss, generate_oss_signed_url, download_oss_to_temp
from app.api.deps import get_current_user, get_optional_user
from app.models.meta import ProfessionalGroup, Major, Course, IdeologyTag
from app.models.resource import Resource, resource_tags
from app.models.download import DownloadLog
from app.models.user import User
from app.schemas.resource import ResourceCreateIn, ResourcePatchIn
from app.models.audit import ResourceAudit

router = APIRouter(prefix="/api/v1/resources", tags=["resources"])

RESOURCE_TYPES = {
    "text": "文本",
    "slide": "课件",
    "video": "视频",
    "audio": "音频",
    "image": "图片",
    "doc": "文档",
    "policy": "政策",
    "practice": "案例",
    "link": "链接",
}
ALLOWED_STATUS = {"draft", "published"}
DEFAULT_COVERS = {
    "text": "/sample-covers/text.jpg",
    "slide": "/sample-covers/slide.jpg",
    "video": "/sample-covers/video.jpg",
    "audio": "/sample-covers/audio.jpg",
    "image": "/sample-covers/image.jpg",
    "doc": "/sample-covers/doc.jpg",
    "policy": "/sample-covers/policy.jpg",
    "practice": "/sample-covers/practice.jpg",
    "link": "/sample-covers/link.jpg",
}
DEFAULT_COVER_FALLBACK = "/sample-covers/default-cover.jpg"


def _default_cover(rt: str | None) -> str:
    return DEFAULT_COVERS.get(rt or "", DEFAULT_COVER_FALLBACK)


def _cover_public_url(r: Resource, request: Request | None = None) -> str:
    """
    返回可供前端展示的封面地址：
    - 空值：按类型默认封面
    - 本地上传：cover_url 形如 local:filename，返回 /api/v1/resources/{rid}/cover-file?file=filename
    - OSS 上传：cover_url 形如 oss:key，生成签名 URL
    - 其他：直接返回 cover_url（可为前端静态路径或 http(s)）
    """
    if not r.cover_url:
        return _default_cover(r.resource_type)
    if r.cover_url.startswith("oss:"):
        key = r.cover_url.replace("oss:", "", 1)
        return generate_oss_signed_url(key, settings.SIGNED_URL_EXPIRES_SECONDS)
    if r.cover_url.startswith("local:"):
        filename = r.cover_url.replace("local:", "", 1)
        if request:
            base = str(request.base_url).rstrip("/")
            return f"{base}/api/v1/resources/{r.id}/cover-file?file={filename}"
        return f"/api/v1/resources/{r.id}/cover-file?file={filename}"
    return r.cover_url

def _safe_filename(name: str) -> str:
    cleaned = name.replace("\\", "_").replace("/", "_").replace("..", "_")
    return cleaned.strip() or "file"


def _allowed_exts() -> set[str]:
    return {x.strip().lower() for x in settings.ALLOWED_FILE_EXT.split(",") if x.strip()}


def _allowed_mimes() -> dict[str, set[str]]:
    return {
        "pdf": {"application/pdf"},
        "pptx": {
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint",
        },
        "docx": {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        },
        "xlsx": {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
        },
        "mp4": {"video/mp4", "application/mp4"},
        "png": {"image/png"},
        "jpg": {"image/jpeg"},
        "jpeg": {"image/jpeg"},
        "zip": {"application/zip", "application/x-zip-compressed"},
    }


def _calc_can_download(user: User, r: Resource) -> bool:
    if user.role == "admin":
        return True
    if r.status == "published":
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


def _probe_duration(path: str) -> int | None:
    """使用 ffprobe 探测音视频时长（秒）。"""
    try:
        res = subprocess.run([
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path,
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        out = res.stdout.decode().strip()
        seconds = float(out)
        return int(seconds)
    except Exception:
        return None


def _ensure_local_file(r: Resource) -> str:
    """Ensure the resource file exists locally (download from OSS if needed)."""
    if not r.file_id or not r.file_name:
        raise not_found()
    if is_oss_enabled():
        return download_oss_to_temp(r.file_id)
    storage_name = f"{r.file_id}_{r.file_name}"
    path = os.path.join(settings.UPLOAD_DIR, storage_name)
    if not os.path.exists(path):
        raise not_found()
    return path


def _ensure_preview_pdf(r: Resource) -> str:
    """Convert office documents to PDF for preview, with caching."""
    os.makedirs(settings.PREVIEW_DIR, exist_ok=True)
    preview_path = os.path.join(settings.PREVIEW_DIR, f"{r.file_id}.pdf")
    if os.path.exists(preview_path):
        return preview_path
    src_path = _ensure_local_file(r)
    try:
        subprocess.run([
            "soffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            settings.PREVIEW_DIR,
            src_path,
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        raise AppError(code="PREVIEW_NOT_AVAILABLE", message="未安装 LibreOffice，无法生成预览", status_code=503)
    except subprocess.CalledProcessError as e:
        raise AppError(code="PREVIEW_CONVERT_FAILED", message=f"预览生成失败: {e.stderr.decode(errors='ignore')}", status_code=500)

    if not os.path.exists(preview_path):
        pdfs = sorted([p for p in os.listdir(settings.PREVIEW_DIR) if p.endswith('.pdf')], reverse=True)
        if pdfs:
            preview_path = os.path.join(settings.PREVIEW_DIR, pdfs[0])
    if not os.path.exists(preview_path):
        raise AppError(code="PREVIEW_CONVERT_FAILED", message="预览生成失败", status_code=500)
    return preview_path


def _cover_local_path(filename: str) -> Path:
    """本地封面文件存储路径（UPLOAD_DIR/covers/filename）。"""
    base = Path(settings.UPLOAD_DIR) / "covers"
    base.mkdir(parents=True, exist_ok=True)
    return base / filename

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
    mine: bool = False,
    resource_type: str | None = None,
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

    q = db.query(Resource).filter(Resource.deleted_at.is_(None))
    if mine:
        if not user:
            raise permission_denied()
        q = q.filter(Resource.owner_user_id == user.id)
    else:
        if not user:
            q = q.filter(Resource.status == "published")
        else:
            if user.role != "admin":
                q = q.filter(or_(Resource.status == "published", Resource.owner_user_id == user.id))
    if status:
        if status not in ALLOWED_STATUS:
            raise validation_error("状态不合法")
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
    if resource_type:
        q = q.filter(Resource.resource_type == resource_type)

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
        owner = db.query(User).filter(User.id == r.owner_user_id).first()
        can_manage = bool(user and (user.role == "admin" or r.owner_user_id == user.id))
        can_publish = can_manage and r.status != "published"
        can_archive = can_manage and r.status == "published"
        status_out = r.status if r.status in ALLOWED_STATUS else "draft"
        cover_out = _cover_public_url(r, request)
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
            "resource_type": r.resource_type,
            "tag_ids": names["tag_ids"],
            "tag_names": names["tag_names"],
            "source_type": r.source_type,
            "file_type": r.file_type,
            "status": status_out,
            "download_count": r.download_count,
            "view_count": r.view_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "published_at": r.published_at.isoformat() if r.published_at else None,
            "cover_url": cover_out,
            "duration_seconds": r.duration_seconds,
            "audience": r.audience,
            "owner": None,
        }
        if user:
            base.update(
                {
                    "can_download": _calc_can_download(user, r),
                    "can_edit": _calc_can_edit(user, r),
                    "can_publish": can_publish,
                    "can_archive": can_archive,
                    "can_manage": can_manage,
                    "owner": {"id": r.owner_user_id, "name": owner.name if owner else None, "username": owner.username if owner else None},
                }
            )
        items.append(base)

    return ok(request, {"page": page, "page_size": page_size, "total": total, "items": items})


@router.get("/summary")
def summary(
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
    level: str = "group",
    group_id: int | None = None,
    major_id: int | None = None,
    course_id: int | None = None,
    limit: int = 200,
    include_empty: bool = True,
):
    """
    分层汇总：用于图谱/思维导图懒加载。
    level: group | major | course | type
    约束：
      - level=major 需要group_id
      - level=course 需要major_id
      - level=type 可透过course_id/major_id/group_id 进一步过滤
    权限：
      - 未登录：仅统计已发布
      - 教师：统计已发布 + 自己的资源
      - 管理员：可统计全部
    include_empty: 是否返回计数为 0 的节点（用于图谱结构补全）
    """
    limit = max(1, min(limit, 500))

    # 仅统计已发布且未删除的资源
    res_q = db.query(
        Resource.id,
        Resource.group_id,
        Resource.major_id,
        Resource.course_id,
        Resource.resource_type,
    ).filter(Resource.status == "published", Resource.deleted_at.is_(None))

    if group_id:
        res_q = res_q.filter(Resource.group_id == group_id)
    if major_id:
        res_q = res_q.filter(Resource.major_id == major_id)
    if course_id:
        res_q = res_q.filter(Resource.course_id == course_id)

    res_sub = res_q.subquery()

    if level == "group":
        rows = (
            db.query(
                ProfessionalGroup.id.label("gid"),
                ProfessionalGroup.name.label("gname"),
                func.count(res_sub.c.id).label("cnt"),
            )
            .select_from(ProfessionalGroup)
            .outerjoin(res_sub, ProfessionalGroup.id == res_sub.c.group_id)
            .group_by(ProfessionalGroup.id, ProfessionalGroup.name)
            .order_by(ProfessionalGroup.id.asc())
            .limit(limit)
            .all()
        )
        items = [
            {"group_id": gid, "group_name": name, "count": int(cnt or 0)}
            for gid, name, cnt in rows
            if include_empty or cnt
        ]
        return ok(request, {"level": "group", "items": items})

    if level == "major":
        if not group_id:
            raise validation_error("缺少 group_id")
        rows = (
            db.query(
                Major.id.label("mid"),
                Major.name.label("mname"),
                func.count(res_sub.c.id).label("cnt"),
            )
            .select_from(Major)
            .filter(Major.group_id == group_id)
            .outerjoin(res_sub, res_sub.c.major_id == Major.id)
            .group_by(Major.id, Major.name, Major.sort_order)
            .order_by(Major.sort_order.asc(), Major.id.asc())
            .limit(limit)
            .all()
        )
        items = [
            {"major_id": mid, "major_name": name, "count": int(cnt or 0)}
            for mid, name, cnt in rows
            if include_empty or cnt
        ]
        return ok(request, {"level": "major", "parent_group_id": group_id, "items": items})

    if level == "course":
        if not major_id:
            raise validation_error("缺少 major_id")
        rows = (
            db.query(
                Course.id.label("cid"),
                Course.name.label("cname"),
                func.count(res_sub.c.id).label("cnt"),
            )
            .select_from(Course)
            .filter(Course.major_id == major_id)
            .outerjoin(res_sub, res_sub.c.course_id == Course.id)
            .group_by(Course.id, Course.name)
            .order_by(Course.id.asc())
            .limit(limit)
            .all()
        )
        items = [
            {"course_id": cid, "course_name": name, "count": int(cnt or 0)}
            for cid, name, cnt in rows
            if include_empty or cnt
        ]
        return ok(request, {"level": "course", "parent_major_id": major_id, "items": items})

    if level == "type":
        rows = (
            res_q.with_entities(Resource.resource_type, func.count(Resource.id))
            .group_by(Resource.resource_type)
            .order_by(Resource.resource_type.asc())
            .limit(limit)
            .all()
        )
        items = [
            {"resource_type": rt, "label": RESOURCE_TYPES.get(rt, rt), "count": int(cnt or 0)}
            for rt, cnt in rows
            if rt or include_empty
        ]
        return ok(
            request,
            {
                "level": "type",
                "parent_group_id": group_id,
                "parent_major_id": major_id,
                "parent_course_id": course_id,
                "items": items,
            },
        )

    raise validation_error("level 必须是group/major/course/type 之一")


@router.get("/tags-cloud")
def tags_cloud(
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
    group_id: int | None = None,
    major_id: int | None = None,
    course_id: int | None = None,
    limit: int = 50,
):
    """
    标签云：统计已发布资源的标签数量，支持按专业群/专业/课程过滤。
    未登录：仅统计已发布；教师：发布+自己的；管理员：全部。
    """
    limit = max(1, min(limit, 200))
    res_q = db.query(Resource).filter(Resource.deleted_at.is_(None))
    if not user:
        res_q = res_q.filter(Resource.status == "published")
    else:
        if user.role != "admin":
            res_q = res_q.filter(or_(Resource.status == "published", Resource.owner_user_id == user.id))
    if group_id:
        res_q = res_q.filter(Resource.group_id == group_id)
    if major_id:
        res_q = res_q.filter(Resource.major_id == major_id)
    if course_id:
        res_q = res_q.filter(Resource.course_id == course_id)

    res_sub = res_q.subquery()
    rows = (
        db.query(IdeologyTag.id, IdeologyTag.name, func.count(res_sub.c.id))
        .join(resource_tags, resource_tags.c.tag_id == IdeologyTag.id)
        .join(res_sub, resource_tags.c.resource_id == res_sub.c.id)
        .group_by(IdeologyTag.id, IdeologyTag.name)
        .order_by(func.count(res_sub.c.id).desc(), IdeologyTag.id.asc())
        .limit(limit)
        .all()
    )
    items = [{"tag_id": tid, "tag_name": name, "count": int(cnt or 0)} for tid, name, cnt in rows if cnt]
    return ok(request, {"items": items})


@router.get("/my-filters")
def my_filters(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    返回当前用户已创建资源所涉及的课程、标签，供筛选下拉使用。
    """
    course_ids = (
        db.query(Resource.course_id)
        .filter(Resource.owner_user_id == user.id, Resource.course_id.isnot(None))
        .distinct()
        .all()
    )
    course_id_list = [cid for (cid,) in course_ids if cid]
    courses = []
    if course_id_list:
        courses = (
            db.query(Course.id, Course.name)
            .filter(Course.id.in_(course_id_list))
            .order_by(Course.id.asc())
            .all()
        )

    tag_ids = (
        db.query(resource_tags.c.tag_id)
        .join(Resource, resource_tags.c.resource_id == Resource.id)
        .filter(Resource.owner_user_id == user.id)
        .distinct()
        .all()
    )
    tag_id_list = [tid for (tid,) in tag_ids if tid]
    tags = []
    if tag_id_list:
        tags = (
            db.query(IdeologyTag.id, IdeologyTag.name)
            .filter(IdeologyTag.id.in_(tag_id_list))
            .order_by(IdeologyTag.id.asc())
            .all()
        )

    return ok(
        request,
        {
            "courses": [{"id": cid, "name": name} for cid, name in courses],
            "tags": [{"id": tid, "name": name} for tid, name in tags],
        },
    )

@router.get("/{rid}")
def get_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()

    if user.role != "admin" and not (r.status == "published" or r.owner_user_id == user.id):
        raise permission_denied()

    names = _enrich_names(db, r)
    owner = db.query(User).filter(User.id == r.owner_user_id).first()
    can_manage = bool(user and (user.role == "admin" or r.owner_user_id == user.id))
    can_publish = can_manage and r.status != "published"
    can_archive = can_manage and r.status == "published"
    status_out = r.status if r.status in ALLOWED_STATUS else "draft"
    cover_out = _cover_public_url(r, request)
    r.view_count = (r.view_count or 0) + 1
    db.commit()
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
        "resource_type": r.resource_type,
        "tag_ids": names["tag_ids"],
        "tag_names": names["tag_names"],
        "source_type": r.source_type,
        "file_type": r.file_type,
        "status": status_out,
        "download_count": r.download_count,
        "view_count": r.view_count,
        "owner": {"id": r.owner_user_id, "name": owner.name if owner else None, "username": owner.username if owner else None},
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "published_at": r.published_at.isoformat() if r.published_at else None,
        "cover_url": cover_out,
        "duration_seconds": r.duration_seconds,
        "audience": r.audience,
    }

    if user:
        data.update(
            {
                "can_download": _calc_can_download(user, r),
                "can_edit": _calc_can_edit(user, r),
                "can_publish": can_publish,
                "can_archive": can_archive,
                "can_manage": can_manage,
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


@router.get("/{rid}/preview")
def preview_resource(
    rid: int,
    request: Request,
    stream: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    if user.role != "admin" and not (r.status == "published" or r.owner_user_id == user.id):
        raise permission_denied()

    ext = (r.file_type or "").lower()
    mime = r.file_mime or "application/octet-stream"
    inline_types = {"png", "jpg", "jpeg", "gif", "webp", "pdf", "mp4", "mp3"}
    office_types = {"pptx", "docx", "xlsx"}

    # 外链资源直接跳转
    # 外链资源：可直接内嵌展示的类型
    if r.source_type == "url":
        if not r.external_url:
            raise not_found()
        url = r.external_url
        if url.startswith("/"):
            url = str(request.base_url).rstrip("/") + url
        if ext in inline_types:
            return ok(request, {"mode": "inline", "url": url, "mime": mime, "ext": ext})
        return ok(request, {"mode": "external", "url": url, "mime": mime, "ext": ext})

    if not r.file_id or not r.file_name:
        raise not_found()

    if ext in inline_types:
        # 生成签名 URL，供 iframe/img/video 直接访问
        if is_oss_enabled():
            preview_url = generate_oss_signed_url(r.file_id, settings.SIGNED_URL_EXPIRES_SECONDS)
        else:
            exp_ts = int(datetime.now(timezone.utc).timestamp()) + settings.SIGNED_URL_EXPIRES_SECONDS
            sig = sign_download(r.file_id, exp_ts, user.id)
            base = str(request.base_url).rstrip("/")
            preview_url = f"{base}/api/v1/files/signed/{r.file_id}?exp={exp_ts}&uid={user.id}&sig={sig}"
        if stream:
            # 直接回源文件
            path = _ensure_local_file(r)
            return FileResponse(path, media_type=mime, filename=r.file_name)
        return ok(request, {"mode": "inline", "url": preview_url, "mime": mime, "ext": ext})

    if ext in office_types:
        pdf_path = _ensure_preview_pdf(r)
        if stream:
            return FileResponse(pdf_path, media_type="application/pdf", filename=f"{r.file_name}.pdf")
        preview_stream_url = f"{str(request.base_url).rstrip('/')}/api/v1/resources/{rid}/preview?stream=1"
        return ok(
            request,
            {
                "mode": "pdf_preview",
                "url": preview_stream_url,
                "mime": "application/pdf",
                "ext": "pdf",
                "note": "已转换为 PDF 预览",
            },
        )

    return ok(request, {"mode": "unsupported", "note": "暂不支持在线预览，请下载查看", "mime": mime, "ext": ext})


@router.post("/{rid}/cover")
def upload_cover(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    file: UploadFile = File(...),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    if user.role != "admin" and not (r.owner_user_id == user.id and r.status == "draft"):
        raise permission_denied()

    filename = _safe_filename(file.filename or "cover")
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in {"png", "jpg", "jpeg"}:
        raise AppError(code="COVER_TYPE_NOT_ALLOWED", message="封面仅支持 png/jpg", status_code=415)

    max_bytes = min(settings.MAX_UPLOAD_MB * 1024 * 1024, 10 * 1024 * 1024)  # 封面限制 10MB
    if is_oss_enabled():
        key = f"cover_{rid}_{uuid.uuid4().hex}.{ext}"
        try:
            _, _ = save_file_oss(file.file, key)
        except ValueError:
            raise AppError(code="FILE_TOO_LARGE", message="封面过大", status_code=413)
        r.cover_url = f"oss:{key}"
    else:
        storage_name = f"cover_{rid}_{uuid.uuid4().hex}.{ext}"
        storage_path = _cover_local_path(storage_name)
        try:
            _, _ = save_file_local(file.file, str(storage_path), max_bytes)
        except ValueError:
            raise AppError(code="FILE_TOO_LARGE", message="封面过大", status_code=413)
        r.cover_url = f"local:{storage_name}"
    db.commit()
    return ok(request, {"cover_url": _cover_public_url(r, request)})


@router.get("/{rid}/cover-file")
def get_cover_file(
    rid: int,
    file: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    # 封面为低敏感内容，允许公开访问；如需收紧可改为仅已发布或校验签名

    path = _cover_local_path(file)
    if not path.exists():
        raise not_found()
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(str(path), media_type=mime, filename=path.name)


@router.post("")
def create_resource(
    payload: ResourceCreateIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in ("admin", "teacher"):
        raise permission_denied()

    if payload.resource_type not in RESOURCE_TYPES:
        raise validation_error("资源类型不合法")
    if payload.source_type not in ("upload", "url"):
        raise validation_error("source_type 不合法，应为 upload 或 url")
    if payload.source_type == "url":
        if not payload.external_url:
            raise validation_error("外链模式必须提供 external_url")
    if payload.source_type == "upload" and payload.external_url:
        raise validation_error("上传模式下 external_url 必须为空")

    status_val = payload.status or "draft"
    if status_val not in ALLOWED_STATUS:
        status_val = "draft"
    cover_val = payload.cover_url or _default_cover(payload.resource_type)

    course_id = payload.course_id
    if not course_id and payload.course_name:
        course_name = payload.course_name.strip()
        if course_name:
            course = (
                db.query(Course)
                .filter(Course.major_id == payload.major_id, Course.name == course_name)
                .first()
            )
            if not course:
                course = Course(name=course_name, major_id=payload.major_id, is_active=True)
                db.add(course)
                db.flush()
            course_id = course.id

    tag_ids: list[int] = list(payload.tag_ids or [])
    for name in payload.tag_names or []:
        tag_name = name.strip()
        if not tag_name:
            continue
        tag = db.query(IdeologyTag).filter(IdeologyTag.name == tag_name).first()
        if not tag:
            tag = IdeologyTag(name=tag_name, is_active=True)
            db.add(tag)
            db.flush()
        tag_ids.append(tag.id)
    tag_ids = list(dict.fromkeys(tag_ids))

    r = Resource(
        title=payload.title,
        abstract=payload.abstract or "",
        group_id=payload.group_id,
        major_id=payload.major_id,
        course_id=course_id,
        resource_type=payload.resource_type,
        source_type=payload.source_type,
        file_type=payload.file_type,
        external_url=payload.external_url,
        cover_url=cover_val,
        duration_seconds=payload.duration_seconds,
        audience=payload.audience,
        status=status_val,
        owner_user_id=user.id,
    )
    db.add(r)
    db.flush()

    for tid in tag_ids:
        db.execute(resource_tags.insert().values(resource_id=r.id, tag_id=tid))

    if status_val == "published":
        r.published_at = datetime.now(timezone.utc)

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
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()

    if user.role != "admin":
        if not (r.owner_user_id == user.id and r.status == "draft"):
            raise permission_denied()

    for k, v in payload.model_dump(exclude_unset=True).items():
        if k == "tag_ids":
            continue
        if k == "resource_type" and v not in RESOURCE_TYPES:
            raise validation_error("资源类型不合法")
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
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()

    if user.role != "admin" and not (r.owner_user_id == user.id and r.status == "draft"):
        raise permission_denied()

    filename = _safe_filename(file.filename or "file")
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in _allowed_exts():
        raise AppError(code="FILE_TYPE_NOT_ALLOWED", message="文件类型不允许上传", status_code=415)

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    allowed_mimes = _allowed_mimes()
    if file.content_type and ext in allowed_mimes and file.content_type not in allowed_mimes[ext]:
        raise AppError(code="FILE_TYPE_NOT_ALLOWED", message="文件类型与扩展名不匹配", status_code=415)

    file_id = f"file_{uuid.uuid4().hex}"
    detected_duration: int | None = None
    if is_oss_enabled():
        key = f"{file_id}_{filename}"
        try:
            size, sha = save_file_oss(file.file, key)
        except ValueError:
            raise AppError(code="FILE_TOO_LARGE", message="文件过大", status_code=413)
        r.file_id = key
        r.file_name = filename
        r.file_size_bytes = size
        r.file_mime = file.content_type
        r.file_sha256 = sha
        if ext in {"mp4", "mp3", "wav", "m4a"}:
            try:
                local_path = download_oss_to_temp(key)
                detected_duration = _probe_duration(local_path)
                Path(local_path).unlink(missing_ok=True)
            except Exception:
                detected_duration = None
    else:
        Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
        storage_name = f"{file_id}_{filename}"
        storage_path = Path(settings.UPLOAD_DIR) / storage_name
        try:
            size, sha = save_file_local(file.file, str(storage_path), max_bytes)
        except ValueError:
            raise AppError(code="FILE_TOO_LARGE", message="文件过大", status_code=413)
        r.file_id = file_id
        r.file_name = filename
        r.file_size_bytes = size
        r.file_mime = file.content_type
        r.file_sha256 = sha
        if ext in {"mp4", "mp3", "wav", "m4a"}:
            detected_duration = _probe_duration(str(storage_path))

    if detected_duration:
        r.duration_seconds = detected_duration
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
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    if user.role != "admin" and r.owner_user_id != user.id:
        raise permission_denied()
    # 简化流程：提交后标记为草稿，等待管理员发布
    r.status = "draft"
    db.commit()
    return ok(request, {"id": r.id, "status": r.status})


@router.post("/{rid}/publish")
def publish_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    if user.role != "admin" and not (user.role == "teacher" and r.owner_user_id == user.id):
        raise permission_denied()
    r.status = "published"
    r.published_at = datetime.now(timezone.utc)
    db.add(
        ResourceAudit(
            resource_id=r.id,
            action="publish",
            user_id=user.id,
            ip=request.client.host if request.client else None,
        )
    )
    db.commit()
    return ok(request, {"id": r.id, "status": r.status, "published_at": r.published_at.isoformat()})


@router.post("/{rid}/archive")
def archive_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    if user.role != "admin" and r.owner_user_id != user.id:
        raise permission_denied()
    r.status = "draft"  # 下架后回到草稿
    r.published_at = None
    db.add(
        ResourceAudit(
            resource_id=r.id,
            action="archive",
            user_id=user.id,
            ip=request.client.host if request.client else None,
        )
    )
    db.commit()
    return ok(request, {"id": r.id, "status": r.status})


@router.delete("/{rid}")
def delete_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()

    if user.role == "admin":
        pass
    else:
        if not (user.role == "teacher" and r.owner_user_id == user.id and r.status == "draft"):
            raise permission_denied()

    db.execute(resource_tags.delete().where(resource_tags.c.resource_id == r.id))
    r.deleted_at = datetime.now(timezone.utc)
    db.add(
        ResourceAudit(
            resource_id=r.id,
            action="delete",
            user_id=user.id,
            ip=request.client.host if request.client else None,
        )
    )
    db.commit()
    return no_content()


@router.get("/{rid}/download")
def download_resource(
    rid: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = db.query(Resource).filter(Resource.id == rid, Resource.deleted_at.is_(None)).first()
    if not r:
        raise not_found()
    if not _calc_can_download(user, r):
        raise permission_denied()
    if r.source_type == "url":
        ip = request.client.host if request.client else None
        ua = request.headers.get("user-agent")
        db.add(DownloadLog(resource_id=r.id, user_id=user.id, ip=ip, user_agent=ua))
        r.download_count = (r.download_count or 0) + 1
        db.commit()
        return ok(request, {"download_url": r.external_url, "expires_in": settings.SIGNED_URL_EXPIRES_SECONDS})
    if not r.file_id:
        raise not_found()

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    db.add(DownloadLog(resource_id=r.id, user_id=user.id, ip=ip, user_agent=ua))
    r.download_count = (r.download_count or 0) + 1
    db.commit()

    if is_oss_enabled():
        download_url = generate_oss_signed_url(r.file_id, settings.SIGNED_URL_EXPIRES_SECONDS)
        return ok(request, {"download_url": download_url, "expires_in": settings.SIGNED_URL_EXPIRES_SECONDS})

    exp_ts = int(datetime.now(timezone.utc).timestamp()) + settings.SIGNED_URL_EXPIRES_SECONDS
    sig = sign_download(r.file_id, exp_ts, user.id)
    base = str(request.base_url).rstrip("/")
    download_url = f"{base}/api/v1/files/signed/{r.file_id}?exp={exp_ts}&uid={user.id}&sig={sig}"
    return ok(request, {"download_url": download_url, "expires_in": settings.SIGNED_URL_EXPIRES_SECONDS})



