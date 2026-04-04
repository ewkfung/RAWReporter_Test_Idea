from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy

from rawreporter.config import get_settings

bearer_transport = BearerTransport(tokenUrl="/api/v1/auth/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=get_settings().SECRET_KEY,
        lifetime_seconds=3600 * 8,  # 8 hours
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)
