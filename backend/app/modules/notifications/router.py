from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import habit_logic
from app.core.database import get_db
from app.core.dates import user_today
from app.core.deps import get_current_user
from app.core.timeutils import utcnow
from app.modules.notifications.models import NotificationEvent, NotificationSettings
from app.modules.records.models import HabitRecord
from app.modules.users.models import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class SettingsUpdate(BaseModel):
    daily_summary_enabled: bool | None = None
    daily_summary_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    habit_reminders_enabled: bool | None = None


async def get_or_create_settings(db: AsyncSession, user_id: int) -> NotificationSettings:
    s = await db.scalar(select(NotificationSettings).where(NotificationSettings.user_id == user_id))
    if s is None:
        s = NotificationSettings(user_id=user_id)
        db.add(s)
        await db.commit()
        await db.refresh(s)
    return s


@router.get("/settings")
async def read_settings(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    s = await get_or_create_settings(db, user.id)
    return {
        "daily_summary_enabled": s.daily_summary_enabled,
        "daily_summary_time": s.daily_summary_time,
        "habit_reminders_enabled": s.habit_reminders_enabled,
    }


@router.put("/settings")
async def update_settings(
    payload: SettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    s = await get_or_create_settings(db, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    await db.commit()
    return {
        "daily_summary_enabled": s.daily_summary_enabled,
        "daily_summary_time": s.daily_summary_time,
        "habit_reminders_enabled": s.habit_reminders_enabled,
    }


@router.get("/pending")
async def pending_today(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Reminders due today that the frontend can surface via browser notifications."""
    from app.modules.habits.models import Habit

    today = user_today(user.timezone)
    habits = list(
        (
            await db.scalars(
                select(Habit).where(
                    Habit.user_id == user.id, Habit.deleted_at.is_(None), Habit.is_active.is_(True)
                )
            )
        ).all()
    )
    done = set(
        (
            await db.scalars(
                select(HabitRecord.habit_id).where(
                    HabitRecord.user_id == user.id,
                    HabitRecord.record_date == today,
                    HabitRecord.deleted_at.is_(None),
                    HabitRecord.is_completed.is_(True),
                )
            )
        ).all()
    )

    pending = []
    for habit in habits:
        if not habit.reminder_enabled or not habit.reminder_time or habit.id in done:
            continue
        scheduled = habit.schedule_type == "weekly_count" or (
            habit_logic.scheduled_dates(habit.start_date, today, habit.schedule_type, habit.weekly_days or [], habit.end_date)
            and habit_logic.scheduled_dates(habit.start_date, today, habit.schedule_type, habit.weekly_days or [], habit.end_date)[-1] == today
        )
        if not scheduled:
            continue
        pending.append(
            {
                "habit_id": habit.id,
                "name": habit.name,
                "icon": habit.icon,
                "reminder_time": habit.reminder_time,
                "message": f"今天还没有完成「{habit.name}」。",
            }
        )

    settings_row = await get_or_create_settings(db, user.id)
    return {"pending": pending, "daily_summary_time": settings_row.daily_summary_time, "daily_summary_enabled": settings_row.daily_summary_enabled}


@router.get("/inbox")
async def inbox(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user.id)
        .order_by(NotificationEvent.created_at.desc(), NotificationEvent.id.desc())
        .limit(limit)
    )
    if unread_only:
        stmt = stmt.where(NotificationEvent.is_read.is_(False))
    events = list((await db.scalars(stmt)).all())
    return [
        {
            "id": e.id,
            "title": e.title,
            "body": e.body,
            "kind": e.kind,
            "is_read": e.is_read,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@router.post("/inbox/{event_id}/read", status_code=204)
async def mark_read(
    event_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(NotificationEvent)
        .where(NotificationEvent.id == event_id, NotificationEvent.user_id == user.id)
        .values(is_read=True, read_at=utcnow())
    )
    await db.commit()
    return None


@router.post("/inbox/read-all", status_code=204)
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(NotificationEvent)
        .where(NotificationEvent.user_id == user.id, NotificationEvent.is_read.is_(False))
        .values(is_read=True, read_at=datetime.now())
    )
    await db.commit()
    return None
