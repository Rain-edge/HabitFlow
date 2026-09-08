import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.db.base  # noqa: F401 — register all models on Base.metadata
from app.core.database import Base, get_db
from app.main import app

TEST_USER = {"email": "alice@example.com", "username": "alice", "password": "secret123"}


@pytest_asyncio.fixture
async def db(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/test.db")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    from app.modules.achievements.service import ensure_catalog

    async with factory() as session:
        await ensure_catalog(session)

    yield factory

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def register(client: AsyncClient, **overrides) -> dict:
    payload = {**TEST_USER, **overrides}
    resp = await client.post("/api/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest_asyncio.fixture
async def user_client(client):
    data = await register(client)
    client.headers["Authorization"] = f"Bearer {data['access_token']}"
    return client
