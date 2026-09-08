from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import habit_logic
from app.core.database import get_db
from app.core.dates import user_today
from app.core.deps import get_current_user
from app.core.timeutils import utcnow
from app.modules.habits.models import Habit
from app.modules.records.models import HabitRecord
from app.modules.records.schemas import RecordCreate, RecordOut, RecordUpdate
from app.modules.users.models import User

router = APIRouter(prefix="/api/records", tags=["records"])


async def _get_habit(habit_id: int, user: User, db: AsyncSession) -> Habit:
    habit = await db.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id or habit.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


async def _get_owned_record(record_id: int, user: User, db: AsyncSession) -> HabitRecord:
    record = await db.get(HabitRecord, record_id)
    if record is None or record.user_id != user.id or record.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


async def _existing_active(db: AsyncSession, user_id: int, habit_id: int, record_date: date):
    return await db.scalar(
        select(HabitRecord).where(
            HabitRecord.user_id == user_id,
            HabitRecord.habit_id == habit_id,
            HabitRecord.record_date == record_date,
            HabitRecord.deleted_at.is_(None),
        )
    )


@router.get("", response_model=list[RecordOut])
async def list_records(
    habit_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    on_date: date | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(HabitRecord).where(
        HabitRecord.user_id == user.id, HabitRecord.deleted_at.is_(None)
    )
    if habit_id is not None:
        stmt = stmt.where(HabitRecord.habit_id == habit_id)
    if on_date is not None:
        stmt = stmt.where(HabitRecord.record_date == on_date)
    else:
        if date_from is not None:
            stmt = stmt.where(HabitRecord.record_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(HabitRecord.record_date <= date_to)
    stmt = stmt.order_by(HabitRecord.record_date.desc(), HabitRecord.id.desc())
    result = await db.scalars(stmt)
    return list(result.all())


@router.post("", response_model=RecordOut, status_code=201)
async def create_record(
    payload: RecordCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    habit = await _get_habit(payload.habit_id, user, db)
    today = user_today(user.timezone)

    if payload.record_date > today:
        raise HTTPException(status_code=400, detail="Cannot record a future date")
    if habit.end_date is not None and payload.record_date > habit.end_date:
        raise HTTPException(status_code=400, detail="Date is after the habit end date")
    if payload.record_date < habit.start_date:
        raise HTTPException(status_code=400, detail="Date is before the habit start date")

    is_backfilled = payload.record_date < today
    if is_backfilled and not habit.allow_backfill:
        raise HTTPException(status_code=403, detail="Backfill is disabled for this habit")

    if await _existing_active(db, user.id, habit.id, payload.record_date):
        raise HTTPException(status_code=409, detail="A record for this date already exists")

    is_completed = habit_logic.is_record_completed(
        habit.record_type,
        target_value=habit.target_value,
        value_number=payload.value_number,
        value_text=payload.value_text,
        value_time=payload.value_time,
        is_completed=payload.is_completed,
    )

    record = HabitRecord(
        user_id=user.id,
        habit_id=habit.id,
        record_date=payload.record_date,
        value_number=payload.value_number,
        value_text=payload.value_text,
        value_time=payload.value_time,
        is_completed=is_completed,
        is_backfilled=is_backfilled,
        note=payload.note,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    from app.modules.achievements.service import evaluate_user

    await evaluate_user(db, user)

    return record


@router.put("/{record_id}", response_model=RecordOut)
async def update_record(
    record_id: int,
    payload: RecordUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_owned_record(record_id, user, db)
    habit = await db.get(Habit, record.habit_id)

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(record, field, value)

    if habit is not None and habit.deleted_at is None:
        record.is_completed = habit_logic.is_record_completed(
            habit.record_type,
            target_value=habit.target_value,
            value_number=record.value_number,
            value_text=record.value_text,
            value_time=record.value_time,
            is_completed=record.is_completed,
        )
    record.is_backfilled = record.record_date < user_today(user.timezone)

    await db.commit()
    await db.refresh(record)

    from app.modules.achievements.service import evaluate_user

    await evaluate_user(db, user)

    return record


@router.delete("/{record_id}", status_code=204)
async def delete_record(
    record_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    record = await _get_owned_record(record_id, user, db)
    now = utcnow()
    record.deleted_at = now
    record.deleted_epoch = record.id
    await db.commit()
    return None
