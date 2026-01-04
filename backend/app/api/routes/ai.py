from datetime import datetime
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, auth_required
from app.core.response import ok
from app.api.deps import get_optional_user, get_current_user
from app.db.session import get_db
from app.models.ai_chat import AiChatSession, AiChatMessage

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="system/user/assistant")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None
    session_id: int | None = None


class SessionCreateRequest(BaseModel):
    title: str | None = None


def _get_client() -> OpenAI:
    if not settings.AIHUBMIX_API_KEY:
        raise AppError(code="AI_NOT_CONFIGURED", message="AI 服务未配置", status_code=503)
    return OpenAI(api_key=settings.AIHUBMIX_API_KEY, base_url=settings.AIHUBMIX_BASE_URL)


def _session_title_from_message(content: str) -> str:
    text = (content or "").strip().replace("\n", " ")
    if not text:
        return "新对话"
    return text[:40] + ("…" if len(text) > 40 else "")


def _prune_sessions(db: Session, user_id: int) -> None:
    limit = settings.AI_CHAT_MAX_SESSIONS
    count = db.query(AiChatSession).filter(AiChatSession.user_id == user_id).count()
    if count <= limit:
        return
    overflow = count - limit
    old_sessions = (
        db.query(AiChatSession)
        .filter(AiChatSession.user_id == user_id)
        .order_by(AiChatSession.updated_at.asc())
        .limit(overflow)
        .all()
    )
    if not old_sessions:
        return
    old_ids = [s.id for s in old_sessions]
    db.query(AiChatMessage).filter(AiChatMessage.session_id.in_(old_ids)).delete(synchronize_session=False)
    db.query(AiChatSession).filter(AiChatSession.id.in_(old_ids)).delete(synchronize_session=False)


def _prune_messages(db: Session, session_id: int) -> None:
    limit = settings.AI_CHAT_MAX_MESSAGES
    count = db.query(AiChatMessage).filter(AiChatMessage.session_id == session_id).count()
    if count <= limit:
        return
    overflow = count - limit
    old_ids = (
        db.query(AiChatMessage.id)
        .filter(AiChatMessage.session_id == session_id)
        .order_by(AiChatMessage.created_at.asc())
        .limit(overflow)
        .all()
    )
    if not old_ids:
        return
    delete_ids = [row[0] for row in old_ids]
    db.query(AiChatMessage).filter(AiChatMessage.id.in_(delete_ids)).delete(synchronize_session=False)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_optional_user),
):
    if not user:
        raise auth_required()
    try:
        session = None
        if payload.session_id:
            session = (
                db.query(AiChatSession)
                .filter(AiChatSession.id == payload.session_id, AiChatSession.user_id == user.id)
                .first()
            )
            if not session:
                raise AppError(code="AI_SESSION_NOT_FOUND", message="对话不存在", status_code=404)
        if not session:
            title = _session_title_from_message(payload.messages[-1].content if payload.messages else "")
            session = AiChatSession(user_id=user.id, title=title)
            db.add(session)
            db.flush()
            _prune_sessions(db, user.id)

        client = _get_client()
        model = payload.model or settings.AIHUBMIX_CHAT_MODEL
        resp = client.chat.completions.create(
            model=model,
            messages=[m.model_dump() for m in payload.messages],
        )
        content = resp.choices[0].message.content if resp.choices else ""
        now = datetime.utcnow()
        if payload.messages:
            last_user = payload.messages[-1]
            db.add(
                AiChatMessage(
                    session_id=session.id,
                    role=last_user.role,
                    content=last_user.content,
                    created_at=now,
                )
            )
        db.add(
            AiChatMessage(
                session_id=session.id,
                role="assistant",
                content=content,
                created_at=now,
            )
        )
        session.updated_at = now
        _prune_messages(db, session.id)
        db.commit()
        return ok(request, {"content": content, "model": model, "session_id": session.id})
    except AppError:
        raise
    except Exception as exc:
        message = "AI 服务调用失败"
        status_code = 502
        code = "AI_REQUEST_FAILED"
        error_text = str(exc)
        if "429" in error_text or "Too Many Requests" in error_text:
            message = "请求过快，请稍后重试"
            status_code = 429
            code = "AI_RATE_LIMITED"
        raise AppError(code=code, message=message, status_code=status_code, details={"error": error_text})


@router.get("/sessions")
def list_sessions(
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = (
        db.query(AiChatSession)
        .filter(AiChatSession.user_id == user.id)
        .order_by(AiChatSession.updated_at.desc())
        .all()
    )
    items = []
    for s in rows:
        count = db.query(func.count(AiChatMessage.id)).filter(AiChatMessage.session_id == s.id).scalar()
        items.append(
            {
                "id": s.id,
                "title": s.title,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
                "message_count": int(count or 0),
            }
        )
    return ok(request, {"items": items})


@router.get("/sessions/{session_id}")
def get_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = (
        db.query(AiChatSession)
        .filter(AiChatSession.id == session_id, AiChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise AppError(code="AI_SESSION_NOT_FOUND", message="对话不存在", status_code=404)
    messages = (
        db.query(AiChatMessage)
        .filter(AiChatMessage.session_id == session_id)
        .order_by(AiChatMessage.created_at.asc())
        .all()
    )
    items = [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in messages]
    return ok(request, {"session": {"id": session.id, "title": session.title}, "messages": items})


@router.post("/sessions")
def create_session(
    payload: SessionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    title = payload.title.strip() if payload.title else "新对话"
    session = AiChatSession(user_id=user.id, title=title or "新对话")
    db.add(session)
    db.flush()
    _prune_sessions(db, user.id)
    db.commit()
    return ok(request, {"id": session.id, "title": session.title})


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = (
        db.query(AiChatSession)
        .filter(AiChatSession.id == session_id, AiChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise AppError(code="AI_SESSION_NOT_FOUND", message="对话不存在", status_code=404)
    db.query(AiChatMessage).filter(AiChatMessage.session_id == session_id).delete(synchronize_session=False)
    db.delete(session)
    db.commit()
    return ok(request, {"id": session_id})
