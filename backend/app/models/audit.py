from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey

from app.models.base import Base


class ResourceAudit(Base):
    __tablename__ = "resource_audits"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # publish / archive
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    ip = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
