import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from rawreporter.models.base import Base

# Dedicated test database — never points at your dev DB
TEST_DATABASE_URL = (
    "postgresql+asyncpg://rawreporter:rawreporter@localhost:5432/rawreporter_test"
)

@pytest.fixture(scope="session")
async def engine():
    """Create engine and all tables once per test session."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def session(engine):
    """
    Each test gets a session that rolls back after the test completes.
    This means tests never pollute each other.
    """
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        async with session.begin():
            yield session
            await session.rollback()