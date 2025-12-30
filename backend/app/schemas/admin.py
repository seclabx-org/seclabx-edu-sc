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
