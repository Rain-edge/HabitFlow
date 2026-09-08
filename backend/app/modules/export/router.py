import csv
import io
import json
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.achievements.models import Achievement, UserAchievement
from app.modules.daily_journal.models import DailyJournal
from app.modules.habits.models import Habit
from app.modules.records.models import HabitRecord
from app.modules.statistics.service import completed_dates_map, compute_habit_stats
from app.modules.users.models import User

router = APIRouter(prefix="/api/export", tags=["export"])


async def _dump(db: AsyncSession, user: User) -> dict:
    habits = list((await db.scalars(select(Habit).where(Habit.user_id == user.id))).all())
    records = list(
        (
            await db.scalars(
                select(HabitRecord).where(HabitRecord.user_id == user.id, HabitRecord.deleted_at.is_(None))
            )
        ).all()
    )
    journals = list(
        (
            await db.scalars(
                select(DailyJournal).where(DailyJournal.user_id == user.id, DailyJournal.deleted_at.is_(None))
            )
        ).all()
    )
    unlocked = list(
        (await db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))).all()
    )
    achievements = {a.id: a.code for a in (await db.scalars(select(Achievement))).all()}

    stats = {}
    today = datetime.now().date()
    completed_map = await completed_dates_map(db, user.id, [h.id for h in habits])
    completed_records: dict[int, list[HabitRecord]] = {}
    for r in records:
        if r.is_completed:
            completed_records.setdefault(r.habit_id, []).append(r)
    for habit in habits:
        s = compute_habit_stats(habit, completed_map[habit.id], today)
        recs = completed_records.get(habit.id, [])
        s["total_completed"] = len(recs)
        s["normal_completed"] = sum(1 for r in recs if not r.is_backfilled)
        s["backfilled_completed"] = sum(1 for r in recs if r.is_backfilled)
        s.pop("completed_dates", None)
        stats[str(habit.id)] = s

    return {
        "exported_at": datetime.now().isoformat(),
        "user": {"id": user.id, "email": user.email, "username": user.username, "timezone": user.timezone},
        "habits": [_habit_dict(h) for h in habits],
        "records": [_record_dict(r) for r in records],
        "journals": [_journal_dict(j) for j in journals],
        "statistics": stats,
        "achievements": [
            {"code": achievements.get(u.achievement_id), "habit_id": u.habit_id or None, "unlocked_at": u.unlocked_at.isoformat()}
            for u in unlocked
        ],
    }


def _habit_dict(h: Habit) -> dict:
    return {
        "id": h.id, "name": h.name, "description": h.description, "icon": h.icon, "color": h.color,
        "category": h.category, "record_type": h.record_type, "target_value": h.target_value, "unit": h.unit,
        "select_options": h.select_options, "schedule_type": h.schedule_type, "weekly_target": h.weekly_target,
        "weekly_days": h.weekly_days, "start_date": h.start_date.isoformat(),
        "end_date": h.end_date.isoformat() if h.end_date else None,
        "reminder_time": h.reminder_time, "reminder_enabled": h.reminder_enabled,
        "is_active": h.is_active, "show_on_homepage": h.show_on_homepage,
        "counts_for_daily": h.counts_for_daily, "allow_backfill": h.allow_backfill,
        "deleted_at": h.deleted_at.isoformat() if h.deleted_at else None,
        "created_at": h.created_at.isoformat() if h.created_at else None,
    }


def _record_dict(r: HabitRecord) -> dict:
    return {
        "id": r.id, "habit_id": r.habit_id, "record_date": r.record_date.isoformat(),
        "value_number": r.value_number, "value_text": r.value_text, "value_time": r.value_time,
        "is_completed": r.is_completed, "is_backfilled": r.is_backfilled, "note": r.note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _journal_dict(j: DailyJournal) -> dict:
    return {
        "journal_date": j.journal_date.isoformat(), "mood": j.mood, "energy": j.energy,
        "overall": j.overall, "stress": j.stress, "text": j.text,
    }


@router.get("/json")
async def export_json(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await _dump(db, user)
    filename = f"habitflow-export-{datetime.now().strftime('%Y%m%d')}.json"
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/csv")
async def export_csv(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    data = await _dump(db, user)
    buf = io.StringIO()
    buf.write("\ufeff")  # BOM for Excel

    writer = csv.writer(buf)
    writer.writerow(["== habits =="])
    writer.writerow(list(data["habits"][0].keys()) if data["habits"] else ["(none)"])
    for h in data["habits"]:
        writer.writerow(list(h.values()))
    writer.writerow([])

    writer.writerow(["== records =="])
    writer.writerow(list(data["records"][0].keys()) if data["records"] else ["(none)"])
    for r in data["records"]:
        writer.writerow(list(r.values()))
    writer.writerow([])

    writer.writerow(["== journals =="])
    writer.writerow(list(data["journals"][0].keys()) if data["journals"] else ["(none)"])
    for j in data["journals"]:
        writer.writerow(list(j.values()))

    filename = f"habitflow-export-{datetime.now().strftime('%Y%m%d')}.csv"
    return PlainTextResponse(
        content=buf.getvalue(),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
