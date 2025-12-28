from pydantic import BaseModel


class AdminUserCreateIn(BaseModel):
    username: str
    name: str
    role: str
    major_id: int | None = None
    initial_password: str


class AdminUserPatchIn(BaseModel):
    name: str | None = None
    role: str | None = None
    major_id: int | None = None
    is_active: bool | None = None
