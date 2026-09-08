"""Minute-granularity scheduler that produces in-site notification events.

Runs only when ENABLE_SCHEDULER=true. It is intentionally channel-agnostic:
today it writes in-site events; email/Telegram providers can hook into
`dispatch` later without touching the scan loop.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.core import habit_logic
from app.core.database import AsyncSessionLocal
from app.core.dates import user_today
from app.modules.habits.models import Habit
from app.modules.notifications.models import NotificationEvent, NotificationSettings
from app.modules.records.models import HabitRecord
from app.modules.users.models import User

log = logging.getLogger("habitflow.scheduler")


def _now_hhmm() -> str:
    from datetime import datetime

    return datetime.now().strftime("%H:%M")


async def scan_once(session_factory=None) -> int:
    """Create due reminder events. Returns number of events created."""
    created = 0
    hhmm = _now_hhmm()
    factory = session_factory or AsyncSessionLocal
    async with factory() as db:
        users = list((await db.scalars(select(User).where(User.is_active.is_(True)))).all())
        for user in users:
            today = user_today(user.timezone)
            settings_row = await db.scalar(
                select(NotificationSettings).where(NotificationSettings.user_id == user.id)
            )
            habit_reminders_on = settings_row is None or settings_row.habit_reminders_enabled
            summary_on = settings_row is not None and settings_row.daily_summary_enabled
            summary_time = settings_row.daily_summary_time if settings_row else "22:00"

            habits = list(
                (
                    await db.scalars(
                        select(Habit).where(
                            Habit.user_id == user.id,
                            Habit.deleted_at.is_(None),
                            Habit.is_active.is_(True),
                        )
                    )
                ).all()
            )
            done_ids = set(
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

            pending_count = 0
            for habit in habits:
                scheduled = habit_logic.scheduled_dates(
                    habit.start_date, today, habit.schedule_type if habit.schedule_type != "weekly_count" else "daily",
                    habit.weekly_days or [], habit.end_date,
                )
                is_due_today = habit.schedule_type == "weekly_count" or (scheduled and scheduled[-1] == today)
                if is_due_today and habit.id not in done_ids:
                    pending_count += 1

                if not habit_reminders_on or habit.id in done_ids:
                    continue
                if habit.reminder_enabled and habit.reminder_time == hhmm and is_due_today:
                    dedup_kind = f"habit:{habit.id}:{today.isoformat()}"
                    exists = await db.scalar(
                        select(NotificationEvent.id).where(
                            NotificationEvent.user_id == user.id,
                            NotificationEvent.kind == dedup_kind,
                        )
                    )
                    if exists is None:
                        db.add(
                            NotificationEvent(
                                user_id=user.id,
                                title=f"{habit.icon} 该完成「{habit.name}」了",
                                body="今天还没有完成，去打卡吧。",
                                kind=dedup_kind,
                            )
                        )
                        created += 1

            if summary_on and summary_time == hhmm and pending_count:
                dedup_kind = f"summary:{today.isoformat()}"
                exists = await db.scalar(
                    select(NotificationEvent.id).where(
                        NotificationEvent.user_id == user.id,
                        NotificationEvent.kind == dedup_kind,
                    )
                )
                if exists is None:
                    db.add(
                        NotificationEvent(
                            user_id=user.id,
                            title="今日小结",
                            body=f"今天还有 {pending_count} 个习惯没有完成。",
                            kind=dedup_kind,
                        )
                    )
                    created += 1
        if created:
            await db.commit()
    return created


async def scheduler_loop(interval_seconds: int = 60) -> None:
    log.info("scheduler started (interval=%ss)", interval_seconds)
    while True:
        try:
            await scan_once()
        except Exception as exc:  # keep the loop alive
            log.warning("scheduler tick failed: %s", exc)
        await asyncio.sleep(interval_seconds)
