from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models_base import TimestampMixin


class HabitRecord(TimestampMixin, Base):
    __tablename__ = "habit_records"
    __table_args__ = (
        # deleted_epoch = 0 for active rows, set to the row id when soft
        # deleted, so the same date can be re-recorded after a deletion while
        # still enforcing one active record per user+habit+date.
        UniqueConstraint("user_id", "habit_id", "record_date", "deleted_epoch", name="uq_record_user_habit_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    habit_id: Mapped[int] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), index=True, nullable=False
    )

    record_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    value_number: Mapped[float | None] = mapped_column(Float, default=None)
    value_text: Mapped[str | None] = mapped_column(Text, default=None)
    value_time: Mapped[str | None] = mapped_column(String(5), default=None)  # HH:MM
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_backfilled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, default=None)

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    deleted_epoch: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
