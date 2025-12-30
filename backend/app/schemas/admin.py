from typing import Literal
from pydantic import BaseModel


Role = Literal["admin", "teacher"]


class AdminUserCreateIn(BaseModel):
    username: str
    name: str
    role: Role
    group_id: int | None = None
    major_id: int | None = None
    initial_password: str | None = None


class AdminUserPatchIn(BaseModel):
    name: str | None = None
    role: Role | None = None
    group_id: int | None = None
    major_id: int | None = None
    is_active: bool | None = None


class AdminResetPasswordOut(BaseModel):
    id: int
    username: str
    new_password: str


class GroupCreateIn(BaseModel):
    name: str
    code: str | None = None
    sort_order: int | None = 0
    is_active: bool | None = True


class GroupPatchIn(BaseModel):
    name: str | None = None
    code: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class MajorCreateIn(BaseModel):
    group_id: int
    name: str
    code: str | None = None
    sort_order: int | None = 0
    is_active: bool | None = True


class MajorPatchIn(BaseModel):
    group_id: int | None = None
    name: str | None = None
    code: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CourseCreateIn(BaseModel):
    major_id: int
    name: str
    term: str | None = None
    sort_order: int | None = 0
    is_active: bool | None = True


class CoursePatchIn(BaseModel):
    major_id: int | None = None
    name: str | None = None
    term: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class TagCreateIn(BaseModel):
    name: str
    sort_order: int | None = 0
    is_active: bool | None = True


class TagPatchIn(BaseModel):
    name: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
