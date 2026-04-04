import uuid

from fastapi_users import FastAPIUsers

from rawreporter.auth.backend import auth_backend
from rawreporter.auth.manager import get_user_manager
from rawreporter.auth.models import User

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
