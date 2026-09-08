from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models_base import TimestampMixin


class Achievement(TimestampMixin, Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    icon: Mapped[str] = mapped_column(String(16), default="🏅", nullable=False)
    category: Mapped[str] = mapped_column(String(40), default="streak", nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", "habit_id", name="uq_user_achievement_habit"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    achievement_id: Mapped[int] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"), index=True, nullable=False
    )
    habit_id: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0 = global
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
