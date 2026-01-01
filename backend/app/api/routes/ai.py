from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from openai import OpenAI

from app.core.config import settings
from app.core.errors import AppError, auth_required
from app.core.response import ok
from app.api.deps import get_optional_user

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="system/user/assistant")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    model: str | None = None


def _get_client() -> OpenAI:
    if not settings.AIHUBMIX_API_KEY:
        raise AppError(code="AI_NOT_CONFIGURED", message="AI 服务未配置", status_code=503)
    return OpenAI(api_key=settings.AIHUBMIX_API_KEY, base_url=settings.AIHUBMIX_BASE_URL)


@router.post("/chat")
def chat(
    payload: ChatRequest,
    request: Request,
    user=Depends(get_optional_user),
):
    if not user:
        raise auth_required()
    try:
        client = _get_client()
        model = payload.model or settings.AIHUBMIX_CHAT_MODEL
        resp = client.chat.completions.create(
            model=model,
            messages=[m.model_dump() for m in payload.messages],
        )
        content = resp.choices[0].message.content if resp.choices else ""
        return ok(request, {"content": content, "model": model})
    except AppError:
        raise
    except Exception:
        raise AppError(code="AI_REQUEST_FAILED", message="AI 服务调用失败", status_code=502)
