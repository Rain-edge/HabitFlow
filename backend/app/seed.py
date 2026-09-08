"""Demo data seeding (SEED_DEMO_DATA=true). Login: demo@habitflow.dev / demo123456"""

from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.modules.habits.models import Habit
from app.modules.records.models import HabitRecord
from app.modules.users.models import User


async def seed_demo() -> None:
    async with AsyncSessionLocal() as db:
        exists = await db.scalar(select(User).where(User.email == "demo@habitflow.dev"))
        if exists is not None:
            return

        user = User(
            email="demo@habitflow.dev",
            username="demo",
            hashed_password=hash_password("demo123456"),
            timezone="Asia/Shanghai",
        )
        db.add(user)
        await db.flush()

        today = date.today()
        start = today - timedelta(days=30)
        habits = [
            Habit(user_id=user.id, name="喝水", icon="💧", color="#4F8EF7", category="健康",
                  record_type="number", target_value=2000, unit="ml", start_date=start),
            Habit(user_id=user.id, name="运动", icon="🏃", color="#F76E4F", category="健康",
                  record_type="duration", target_value=30, unit="分钟", start_date=start),
            Habit(user_id=user.id, name="早睡", icon="🌙", color="#8B6EF7", category="作息",
                  record_type="time", reminder_time="22:30", reminder_enabled=True, start_date=start),
            Habit(user_id=user.id, name="阅读", icon="📚", color="#4FBF8E", category="学习",
                  record_type="duration", target_value=20, unit="分钟", start_date=start),
            Habit(user_id=user.id, name="心情", icon="😊", color="#F7C94F", category="状态",
                  record_type="rating", target_value=1, unit="分", counts_for_daily=False, start_date=start),
        ]
        db.add_all(habits)
        await db.flush()

        for i in range(30):
            d = start + timedelta(days=i)
            if d >= today:
                break
            for habit in habits:
                if habit.record_type == "number":
                    db.add(HabitRecord(user_id=user.id, habit_id=habit.id, record_date=d,
                                       value_number=1500 + (i % 4) * 300, is_completed=(i % 4) >= 2))
                elif habit.record_type == "duration":
                    v = 15 + (i % 5) * 10
                    db.add(HabitRecord(user_id=user.id, habit_id=habit.id, record_date=d,
                                       value_number=v, is_completed=v >= (habit.target_value or 0)))
                elif habit.record_type == "time":
                    db.add(HabitRecord(user_id=user.id, habit_id=habit.id, record_date=d,
                                       value_time="22:45", is_completed=True))
                elif habit.record_type == "rating":
                    db.add(HabitRecord(user_id=user.id, habit_id=habit.id, record_date=d,
                                       value_number=6 + i % 4, is_completed=True))
        await db.commit()
