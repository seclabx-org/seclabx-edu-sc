from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal
from app.models.base import Base
from app.models.user import User
from app.models.meta import ProfessionalGroup, Major, IdeologyTag, Course
from app.core.security import hash_password


def seed(db: Session):
    g = db.query(ProfessionalGroup).filter(ProfessionalGroup.name == "信息安全技术应用专业群").first()
    if not g:
        g = ProfessionalGroup(name="信息安全技术应用专业群", code="sec_cluster", is_active=True)
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

    # seed demo courses for first major
    major_one = db.query(Major).filter(Major.name == "信息安全技术应用").first()
    if major_one:
        courses = [
            ("网络安全法律法规", "2025-2026-1"),
            ("Web安全基础", "2025-2026-1"),
        ]
        for name, term in courses:
            c = db.query(Course).filter(Course.major_id == major_one.id, Course.name == name).first()
            if not c:
                db.add(Course(major_id=major_one.id, name=name, term=term, is_active=True))

    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        db.add(
            User(
                username="admin",
                name="管理员",
                role="admin",
                major_id=None,
                is_active=True,
                password_hash=hash_password("Admin#123456"),
            )
        )
    db.commit()


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
