from dataclasses import dataclass
from typing import Any


@dataclass
class AppError(Exception):
    code: str
    message: str
    status_code: int = 400
    details: dict[str, Any] | None = None


def validation_error(message: str = "Validation failed", details: dict[str, Any] | None = None) -> AppError:
    return AppError(code="VALIDATION_ERROR", message=message or "参数校验失败", status_code=400, details=details or {})


def auth_required() -> AppError:
    return AppError(code="AUTH_REQUIRED", message="需要登录", status_code=401)


def auth_invalid_credentials() -> AppError:
    return AppError(code="AUTH_INVALID_CREDENTIALS", message="用户名或密码错误", status_code=401)


def permission_denied() -> AppError:
    return AppError(code="PERMISSION_DENIED", message="无权限执行该操作", status_code=403)


def not_found() -> AppError:
    return AppError(code="RESOURCE_NOT_FOUND", message="资源不存在", status_code=404)
