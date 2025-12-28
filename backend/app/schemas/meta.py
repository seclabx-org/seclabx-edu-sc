from pydantic import BaseModel


class GroupOut(BaseModel):
    id: int
    name: str
    code: str | None
    is_active: bool


class MajorOut(BaseModel):
    id: int
    group_id: int
    name: str
    code: str | None
    sort_order: int
    is_active: bool


class CourseOut(BaseModel):
    id: int
    major_id: int
    name: str
    term: str | None
    is_active: bool


class TagOut(BaseModel):
    id: int
    name: str
    sort_order: int
    is_active: bool
