from pydantic import BaseModel, Field


class ResourceCreateIn(BaseModel):
    title: str
    abstract: str | None = ""
    group_id: int | None = None
    major_id: int
    course_id: int | None = None
    tag_ids: list[int] | None = None
    source_type: str
    file_type: str
    external_url: str | None = None


class ResourcePatchIn(BaseModel):
    title: str | None = None
    abstract: str | None = None
    group_id: int | None = None
    major_id: int | None = None
    course_id: int | None = None
    tag_ids: list[int] | None = None
    source_type: str | None = None
    file_type: str | None = None
    external_url: str | None = Field(default=None)
