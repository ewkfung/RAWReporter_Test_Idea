import uuid
from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    username: str
    first_name: str
    last_name: str


class UserCreate(schemas.BaseUserCreate):
    username: str
    first_name: str = ""
    last_name: str = ""


class UserUpdate(schemas.BaseUserUpdate):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
