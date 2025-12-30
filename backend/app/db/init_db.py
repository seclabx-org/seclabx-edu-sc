import time
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal
from app.models.base import Base
from app.models.user import User
from app.models.meta import ProfessionalGroup, Major, IdeologyTag, Course
from app.models.resource import Resource  # noqa: F401 - ensure table registered
from app.models.download import DownloadLog  # noqa: F401 - ensure table registered
from app.core.security import hash_password
from app.core.config import settings

GROUP_NAME = "信息安全技术应用专业群"


def migrate_resource_columns():
    """轻量迁移，确保新增字段存在。"""
    stmts = [
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_type VARCHAR(30) NOT NULL DEFAULT 'doc'",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS duration_seconds INTEGER",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS audience VARCHAR(100)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0",
    ]
    with engine.begin() as conn:
        for sql in stmts:
            conn.execute(text(sql))


def seed(db: Session):
    """初始化基础数据与示例资源。"""
    # 专业群 / 专业 / 标签 / 课程
    g = db.query(ProfessionalGroup).filter(ProfessionalGroup.name == GROUP_NAME).first()
    if not g:
        g = ProfessionalGroup(name=GROUP_NAME, code="sec_cluster", is_active=True)
        db.add(g)
        db.flush()

    majors = [
        ("信息安全技术应用", "sec", 10),
        ("计算机网络技术", "net", 20),
        ("大数据技术", "bigdata", 30),
        ("人工智能技术应用", "ai", 40),
        ("物联网应用技术", "iot", 50),
    ]
    for name, code, order in majors:
        m = db.query(Major).filter(Major.group_id == g.id, Major.name == name).first()
        if not m:
            db.add(Major(group_id=g.id, name=name, code=code, sort_order=order, is_active=True))

    tags = [("国家安全", 10), ("法治意识", 20), ("网络伦理", 30), ("工匠精神", 40)]
    for name, order in tags:
        t = db.query(IdeologyTag).filter(IdeologyTag.name == name).first()
        if not t:
            db.add(IdeologyTag(name=name, sort_order=order, is_active=True))
            db.flush()
    tag_rows = db.query(IdeologyTag).all()
    tag_map = {t.name: t.id for t in tag_rows}

    major_one = db.query(Major).filter(Major.name == "信息安全技术应用").first()
    course_map: dict[str, int] = {}
    if major_one:
        courses = [
            ("信息安全技术与实施", "2025-2026-1"),
            ("Web应用安全与防护", "2025-2026-1"),
            ("信息安全风险评估", "2025-2026-1"),
            ("Web应用开发", "2025-2026-1"),
            ("操作系统安全", "2025-2026-1"),
        ]
        for name, term in courses:
            c = db.query(Course).filter(Course.major_id == major_one.id, Course.name == name).first()
            if not c:
                c = Course(major_id=major_one.id, name=name, term=term, is_active=True)
                db.add(c)
                db.flush()
            course_map[name] = c.id

    # 默认管理员
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            name="管理员",
            role="admin",
            major_id=None,
            is_active=True,
            password_hash=hash_password("Admin#123456"),
        )
        db.add(admin)
        db.flush()

    # 示例资源插入策略：开关为 true 时，按标题去重插入；开关为 false 不插入也不删除
    if not settings.SEED_SAMPLE_DATA:
        db.commit()
        return

    # 示例资源：如未存在同名资源则插入（避免重复）
    if major_one and admin:
        course_one = db.query(Course).filter(Course.major_id == major_one.id).first()
        now = datetime.now(timezone.utc)
        demo_resources = [
            {
                "title": "示例 · 网络安全法解读视频",
                "abstract": "面向信息安全专业的示例视频资源，包含政策解读与课堂讨论点。",
                "resource_type": "video",
                "source_type": "url",
                "file_type": "mp4",
                "external_url": "/sample-files/demo-video.mp4",
                "cover_url": "/sample-covers/demo-cover-video.jpg",
                "duration_seconds": 31,
                "audience": "大一 / 教师示范",
                "course_name": "信息安全技术与实施",
                "tag_names": ["国家安全"],
            },
            {
                "title": "示例 · 思政课件模板（网络安全）",
                "abstract": "课件示例，含课堂讨论与思政要点。",
                "resource_type": "slide",
                "source_type": "url",
                "file_type": "pptx",
                "external_url": "/sample-files/demo-slide.pptx",
                "cover_url": "/sample-covers/demo-cover-slide.jpg",
                "duration_seconds": None,
                "audience": "教师备课",
                "course_name": "Web应用安全与防护",
                "tag_names": ["法治意识"],
            },
            {
                "title": "示例 · 网络安全法（官方PDF）",
                "abstract": "政策法规 PDF 汇编，适用于课堂研讨。",
                "resource_type": "policy",
                "source_type": "url",
                "file_type": "pdf",
                "external_url": "/sample-files/demo-policy.pdf",
                "cover_url": "/sample-covers/demo-cover-policy.jpg",
                "duration_seconds": None,
                "audience": "教师/学生",
                "course_name": "信息安全风险评估",
                "tag_names": ["国家安全", "法治意识"],
            },
            {
                "title": "示例 · 思政案例讲稿（网络伦理）",
                "abstract": "文本讲稿示例，含案例与思政要点。",
                "resource_type": "text",
                "source_type": "url",
                "file_type": "docx",
                "external_url": "/sample-files/demo-text.docx",
                "cover_url": "/sample-covers/demo-cover-text.jpg",
                "duration_seconds": None,
                "audience": "课堂讲授",
                "course_name": "Web应用开发",
                "tag_names": ["网络伦理"],
            },
            {
                "title": "示例 · 思政微课音频（国家安全观）",
                "abstract": "音频微课，适合课前预习或课后复盘。",
                "resource_type": "audio",
                "source_type": "url",
                "file_type": "mp3",
                "external_url": "/sample-files/demo-audio.mp3",
                "cover_url": "/sample-covers/demo-cover-audio.jpg",
                "duration_seconds": 32,
                "audience": "学生自学",
                "course_name": "操作系统安全",
                "tag_names": ["国家安全"],
            },
            {
                "title": "示例 · 思政图片素材（网络安全宣传）",
                "abstract": "海报与案例图片，可用于课堂展示。",
                "resource_type": "image",
                "source_type": "url",
                "file_type": "jpg",
                "external_url": "/sample-files/demo-image.jpg",
                "cover_url": "/sample-covers/demo-image-thumb.jpg",
                "duration_seconds": None,
                "audience": "课堂展示",
                "course_name": "Web应用开发",
                "tag_names": ["工匠精神", "网络伦理"],
            },
        ]
        for res in demo_resources:
            exists = db.query(Resource).filter(Resource.title == res["title"]).first()
            if exists:
                continue
            course_id = None
            if res.get("course_name") and res["course_name"] in course_map:
                course_id = course_map[res["course_name"]]
            elif course_one:
                course_id = course_one.id
            r = Resource(
                title=res["title"],
                abstract=res["abstract"],
                group_id=g.id,
                major_id=major_one.id,
                course_id=course_id,
                resource_type=res["resource_type"],
                source_type=res["source_type"],
                file_type=res["file_type"],
                external_url=res["external_url"],
                cover_url=res["cover_url"],
                duration_seconds=res["duration_seconds"],
                audience=res["audience"],
                status="published",
                owner_user_id=admin.id,
                download_count=0,
                view_count=0,
                created_at=now,
                published_at=now,
            )
            db.add(r)
            db.flush()
            tag_ids = []
            for name in res.get("tag_names") or []:
                if name in tag_map:
                    tag_ids.append(tag_map[name])
            for tid in tag_ids:
                db.execute(
                    text("INSERT INTO resource_tags(resource_id, tag_id) VALUES (:rid, :tid)"),
                    {"rid": r.id, "tid": tid},
                )
    db.commit()


def wait_for_db(max_retries: int = 30, delay_seconds: int = 2):
    """Loop until DB is reachable to avoid container start flapping when Postgres is not ready."""
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                return
        except Exception:
            if attempt == max_retries:
                raise
            time.sleep(delay_seconds)


def main():
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    migrate_resource_columns()
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
