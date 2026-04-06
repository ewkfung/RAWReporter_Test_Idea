from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from rawreporter.auth import current_active_user, fastapi_users
from rawreporter.auth.backend import auth_backend
from rawreporter.auth.schemas import UserCreate, UserRead, UserUpdate
from rawreporter.database import AsyncSessionLocal, engine
from rawreporter.models.base import Base
from rawreporter.routers import audit, clients, engagements, evidence, findings, library, reports, sections, users
from rawreporter.utils.seed_rbac import seed_roles_and_permissions


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as session:
        await seed_roles_and_permissions(session)
    yield
    await engine.dispose()


app = FastAPI(title="RAWReporter API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

# Auth routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"{API_PREFIX}/auth/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"{API_PREFIX}/auth",
    tags=["auth"],
)
# FastAPI-Users users router removed — replaced by custom routers/users.py
# which adds RBAC and role management. The /me endpoint lives in routers/users.py.

# Domain routes
app.include_router(clients.router, prefix=API_PREFIX)
app.include_router(engagements.router, prefix=API_PREFIX)
app.include_router(reports.router, prefix=API_PREFIX)
app.include_router(sections.router, prefix=API_PREFIX)
app.include_router(findings.router, prefix=API_PREFIX)
app.include_router(evidence.router, prefix=API_PREFIX)
app.include_router(library.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
