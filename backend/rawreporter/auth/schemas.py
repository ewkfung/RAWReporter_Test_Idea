import uuid
from fastapi_users import schemas
from pydantic import field_validator


class UserRead(schemas.BaseUser[uuid.UUID]):
    username: str
    first_name: str
    last_name: str


class UserCreate(schemas.BaseUserCreate):
    username: str
    first_name: str = ""
    last_name: str = ""

    @field_validator("username")
    @classmethod
    def lowercase_username(cls, v: str) -> str:
        return v.lower()


class UserUpdate(schemas.BaseUserUpdate):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None

    @field_validator("username")
    @classmethod
    def lowercase_username(cls, v: str | None) -> str | None:
        return v.lower() if v is not None else v
