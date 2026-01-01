from pydantic import BaseModel, Field


class ResourceCreateIn(BaseModel):
    title: str
    abstract: str | None = ""
    group_id: int | None = None
    major_id: int
    course_id: int | None = None
    course_name: str | None = None
    tag_ids: list[int] | None = None
    tag_names: list[str] | None = None
    resource_type: str = "doc"
    source_type: str
    file_type: str
    external_url: str | None = None
    cover_url: str | None = None
    duration_seconds: int | None = None
    audience: str | None = None
    status: str = "draft"


class ResourcePatchIn(BaseModel):
    title: str | None = None
    abstract: str | None = None
    group_id: int | None = None
    major_id: int | None = None
    course_id: int | None = None
    course_name: str | None = None
    tag_ids: list[int] | None = None
    tag_names: list[str] | None = None
    resource_type: str | None = None
    source_type: str | None = None
    file_type: str | None = None
    external_url: str | None = Field(default=None)
    cover_url: str | None = None
    duration_seconds: int | None = None
    audience: str | None = None
