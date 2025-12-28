import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.request_id = f"req_{uuid.uuid4().hex}"
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response
