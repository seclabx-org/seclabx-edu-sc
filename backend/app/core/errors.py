from dataclasses import dataclass
from typing import Any


@dataclass
class AppError(Exception):
    code: str
    message: str
    status_code: int = 400
    details: dict[str, Any] | None = None


def validation_error(message: str = "Validation failed", details: dict[str, Any] | None = None) -> AppError:
    return AppError(code="VALIDATION_ERROR", message=message, status_code=400, details=details or {})


def auth_required() -> AppError:
    return AppError(code="AUTH_REQUIRED", message="Authentication required.", status_code=401)


def auth_invalid_credentials() -> AppError:
    return AppError(code="AUTH_INVALID_CREDENTIALS", message="Invalid username or password.", status_code=401)


def permission_denied() -> AppError:
    return AppError(
        code="PERMISSION_DENIED", message="You do not have permission to perform this action.", status_code=403
    )


def not_found() -> AppError:
    return AppError(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)
