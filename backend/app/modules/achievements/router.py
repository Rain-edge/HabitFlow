from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.modules.achievements.models import Achievement, UserAchievement
from app.modules.achievements.service import evaluate_user
from app.modules.habits.models import Habit
from app.modules.users.models import User

router = APIRouter(prefix="/api/achievements", tags=["achievements"])


@router.get("")
async def list_achievements(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    achievements = list((await db.scalars(select(Achievement).order_by(Achievement.category, Achievement.threshold))).all())
    unlocked = list(
        (
            await db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id))
        ).all()
    )
    habit_names = {
        h.id: h.name
        for h in (await db.scalars(select(Habit).where(Habit.user_id == user.id))).all()
    }

    result = []
    for a in achievements:
        mine = [u for u in unlocked if u.achievement_id == a.id]
        result.append(
            {
                "code": a.code,
                "name": a.name,
                "description": a.description,
                "icon": a.icon,
                "category": a.category,
                "threshold": a.threshold,
                "unlocked": bool(mine),
                "unlocked_count": len(mine),
                "unlocked_details": [
                    {
                        "habit_id": u.habit_id or None,
                        "habit_name": habit_names.get(u.habit_id),
                        "unlocked_at": u.unlocked_at.isoformat(),
                    }
                    for u in mine[:10]
                ],
            }
        )
    return result


@router.post("/evaluate")
async def evaluate(
    user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    newly = await evaluate_user(db, user)
    return {"newly_unlocked": newly}
