from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.models_base import TimestampMixin


class DailyJournal(TimestampMixin, Base):
    __tablename__ = "daily_journals"
    __table_args__ = (
        UniqueConstraint("user_id", "journal_date", "deleted_epoch", name="uq_journal_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    journal_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)

    mood: Mapped[int | None] = mapped_column(Integer, default=None)  # 1-10
    energy: Mapped[int | None] = mapped_column(Integer, default=None)  # 1-10
    overall: Mapped[int | None] = mapped_column(Integer, default=None)  # 1-10
    stress: Mapped[int | None] = mapped_column(Integer, default=None)  # 1-10
    text: Mapped[str | None] = mapped_column(Text, default=None)

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    deleted_epoch: Mapped[int] = mapped_column(default=0, nullable=False)
