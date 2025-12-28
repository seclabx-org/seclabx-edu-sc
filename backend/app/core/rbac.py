from fastapi import Depends
from app.api.deps import get_current_user
from app.core.errors import permission_denied
from app.models.user import User


def require_roles(*roles: str):
    def _guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise permission_denied()
        return user

    return _guard
