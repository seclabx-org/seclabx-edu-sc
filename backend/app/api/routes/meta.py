from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.meta import ProfessionalGroup, Major, Course, IdeologyTag
from app.core.response import ok

router = APIRouter(prefix="/api/v1/meta", tags=["meta"])


@router.get("/groups")
def list_groups(request: Request, db: Session = Depends(get_db)):
    rows = db.query(ProfessionalGroup).filter(ProfessionalGroup.is_active == True).order_by(ProfessionalGroup.id.asc()).all()  # noqa: E712
    data = []
    for g in rows:
        data.append({"id": g.id, "name": g.name, "code": g.code, "is_active": g.is_active})
    return ok(request, data)


@router.get("/majors")
def list_majors(request: Request, db: Session = Depends(get_db), group_id: int | None = None):
    q = db.query(Major).filter(Major.is_active == True)  # noqa: E712
    if group_id:
        q = q.filter(Major.group_id == group_id)
    rows = q.order_by(Major.sort_order.asc(), Major.id.asc()).all()
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
            }
        )
    return ok(request, data)


@router.get("/courses")
def list_courses(request: Request, db: Session = Depends(get_db), major_id: int | None = None):
    q = db.query(Course).filter(Course.is_active == True)  # noqa: E712
    if major_id:
        q = q.filter(Course.major_id == major_id)
    rows = q.order_by(Course.id.asc()).all()
    data = []
    for c in rows:
        data.append({"id": c.id, "major_id": c.major_id, "name": c.name, "term": c.term, "is_active": c.is_active})
    return ok(request, data)


@router.get("/tags")
def list_tags(request: Request, db: Session = Depends(get_db)):
    rows = db.query(IdeologyTag).filter(IdeologyTag.is_active == True).order_by(IdeologyTag.sort_order.asc()).all()  # noqa: E712
    data = []
    for t in rows:
        data.append({"id": t.id, "name": t.name, "sort_order": t.sort_order, "is_active": t.is_active})
    return ok(request, data)
