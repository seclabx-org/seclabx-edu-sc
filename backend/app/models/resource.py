from datetime import datetime
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Table,
    Column,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

resource_tags = Table(
    "resource_tags",
    Base.metadata,
    Column("resource_id", ForeignKey("resources.id"), primary_key=True),
    Column("tag_id", ForeignKey("ideology_tags.id"), primary_key=True),
)


class Resource(Base):
    __tablename__ = "resources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    abstract: Mapped[str] = mapped_column(Text, default="", nullable=False)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("professional_groups.id"), nullable=True)
    major_id: Mapped[int] = mapped_column(ForeignKey("majors.id"), nullable=False)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    download_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    file_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_sha256: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
