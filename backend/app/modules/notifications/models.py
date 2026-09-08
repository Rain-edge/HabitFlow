from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models_base import TimestampMixin


class NotificationSettings(TimestampMixin, Base):
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    daily_summary_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily_summary_time: Mapped[str] = mapped_column(String(5), default="22:00", nullable=False)
    habit_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class NotificationEvent(TimestampMixin, Base):
    """In-site notification inbox."""

    __tablename__ = "notification_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, default=None)
    kind: Mapped[str] = mapped_column(String(40), default="reminder", nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
