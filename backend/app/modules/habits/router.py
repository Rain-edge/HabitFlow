from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.timeutils import utcnow
from app.modules.habits.models import Habit
from app.modules.habits.schemas import HabitCreate, HabitOut, HabitUpdate
from app.modules.users.models import User

router = APIRouter(prefix="/api/habits", tags=["habits"])


async def _get_owned_habit(habit_id: int, user: User, db: AsyncSession, include_deleted=False) -> Habit:
    habit = await db.get(Habit, habit_id)
    if habit is None or habit.user_id != user.id:
        raise HTTPException(status_code=404, detail="Habit not found")
    if habit.deleted_at is not None and not include_deleted:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@router.get("", response_model=list[HabitOut])
async def list_habits(
    include_deleted: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Habit).where(Habit.user_id == user.id)
    if not include_deleted:
        stmt = stmt.where(Habit.deleted_at.is_(None))
    stmt = stmt.order_by(Habit.created_at.asc(), Habit.id.asc())
    result = await db.scalars(stmt)
    return list(result.all())


@router.post("", response_model=HabitOut, status_code=201)
async def create_habit(
    payload: HabitCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    habit = Habit(
        user_id=user.id,
        start_date=payload.start_date or date.today(),
        **payload.model_dump(exclude={"start_date"}),
    )
    db.add(habit)
    await db.commit()
    await db.refresh(habit)
    return habit


@router.get("/{habit_id}", response_model=HabitOut)
async def get_habit(
    habit_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_owned_habit(habit_id, user, db)


@router.put("/{habit_id}", response_model=HabitOut)
async def update_habit(
    habit_id: int,
    payload: HabitUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    habit = await _get_owned_habit(habit_id, user, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    await db.commit()
    await db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=204)
async def delete_habit(
    habit_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete: history records stay intact and remain in statistics."""
    habit = await _get_owned_habit(habit_id, user, db)
    habit.deleted_at = utcnow()
    habit.is_active = False
    await db.commit()
    return None


@router.post("/{habit_id}/restore", response_model=HabitOut)
async def restore_habit(
    habit_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    habit = await _get_owned_habit(habit_id, user, db, include_deleted=True)
    habit.deleted_at = None
    habit.is_active = True
    await db.commit()
    await db.refresh(habit)
    return habit
