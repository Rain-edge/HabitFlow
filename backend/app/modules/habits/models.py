from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models_base import TimestampMixin


class Habit(TimestampMixin, Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    icon: Mapped[str] = mapped_column(String(16), default="🌱", nullable=False)
    color: Mapped[str] = mapped_column(String(16), default="#4F8EF7", nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)

    # what gets recorded
    record_type: Mapped[str] = mapped_column(String(20), nullable=False)  # boolean|number|duration|rating|select|text|time
    target_value: Mapped[float | None] = mapped_column(Float, default=None)
    unit: Mapped[str | None] = mapped_column(String(20), default=None)
    select_options: Mapped[list | None] = mapped_column(JSON, default=None)  # for select type

    # when it is expected
    schedule_type: Mapped[str] = mapped_column(String(20), default="daily", nullable=False)  # daily|weekly_count|weekly_days
    weekly_target: Mapped[int | None] = mapped_column(Integer, default=None)  # weekly_count
    weekly_days: Mapped[list | None] = mapped_column(JSON, default=None)  # weekly_days, 0=Monday
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, default=None)

    # reminders & visibility
    reminder_time: Mapped[str | None] = mapped_column(String(5), default=None)  # HH:MM
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    show_on_homepage: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    counts_for_daily: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_backfill: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # soft delete keeps history intact
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
