import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine

logging.basicConfig(level=settings.log_level.upper())


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.core.database import AsyncSessionLocal
    from app.modules.achievements.service import ensure_catalog

    if settings.is_sqlite:
        import app.db.base  # noqa: F401  register models
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await ensure_catalog(db)
        if settings.seed_demo_data:
            from app.seed import seed_demo

            await seed_demo()

    task = None
    if settings.enable_scheduler:
        from app.modules.notifications.scheduler import scheduler_loop

        task = asyncio.create_task(scheduler_loop())

    yield

    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    await engine.dispose()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.modules.achievements.router import router as achievements_router  # noqa: E402
from app.modules.auth.router import router as auth_router  # noqa: E402
from app.modules.daily_journal.router import router as journal_router  # noqa: E402
from app.modules.export.router import router as export_router  # noqa: E402
from app.modules.habits.router import router as habits_router  # noqa: E402
from app.modules.notifications.router import router as notifications_router  # noqa: E402
from app.modules.records.router import router as records_router  # noqa: E402
from app.modules.statistics.router import router as statistics_router  # noqa: E402
from app.modules.users.router import router as users_router  # noqa: E402

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(habits_router)
app.include_router(records_router)
app.include_router(journal_router)
app.include_router(statistics_router)
app.include_router(achievements_router)
app.include_router(notifications_router)
app.include_router(export_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}
