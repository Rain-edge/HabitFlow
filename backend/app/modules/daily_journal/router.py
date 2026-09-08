from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dates import user_today
from app.core.deps import get_current_user
from app.modules.daily_journal.models import DailyJournal
from app.modules.users.models import User

router = APIRouter(prefix="/api/journal", tags=["journal"])


class JournalUpdate(BaseModel):
    mood: int | None = Field(default=None, ge=1, le=10)
    energy: int | None = Field(default=None, ge=1, le=10)
    overall: int | None = Field(default=None, ge=1, le=10)
    stress: int | None = Field(default=None, ge=1, le=10)
    text: str | None = Field(default=None, max_length=5000)


class JournalOut(BaseModel):
    journal_date: date_type
    mood: int | None = None
    energy: int | None = None
    overall: int | None = None
    stress: int | None = None
    text: str | None = None
    has_entry: bool = False
    updated_at: datetime | None = None


async def _find(db: AsyncSession, user_id: int, journal_date: date_type) -> DailyJournal | None:
    return await db.scalar(
        select(DailyJournal).where(
            DailyJournal.user_id == user_id,
            DailyJournal.journal_date == journal_date,
            DailyJournal.deleted_at.is_(None),
        )
    )


@router.get("/{journal_date}", response_model=JournalOut)
async def get_journal(
    journal_date: date_type,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journal = await _find(db, user.id, journal_date)
    if journal is None:
        return JournalOut(journal_date=journal_date)
    return JournalOut(
        journal_date=journal.journal_date,
        mood=journal.mood,
        energy=journal.energy,
        overall=journal.overall,
        stress=journal.stress,
        text=journal.text,
        has_entry=True,
        updated_at=journal.updated_at,
    )


@router.put("/{journal_date}", response_model=JournalOut)
async def upsert_journal(
    journal_date: date_type,
    payload: JournalUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if journal_date > user_today(user.timezone):
        raise HTTPException(status_code=400, detail="Cannot write a journal for a future date")

    journal = await _find(db, user.id, journal_date)
    if journal is None:
        journal = DailyJournal(user_id=user.id, journal_date=journal_date)
        db.add(journal)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(journal, field, value)

    await db.commit()
    await db.refresh(journal)
    return JournalOut(
        journal_date=journal.journal_date,
        mood=journal.mood,
        energy=journal.energy,
        overall=journal.overall,
        stress=journal.stress,
        text=journal.text,
        has_entry=True,
        updated_at=journal.updated_at,
    )


@router.delete("/{journal_date}", status_code=204)
async def delete_journal(
    journal_date: date_type,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    journal = await _find(db, user.id, journal_date)
    if journal is None:
        raise HTTPException(status_code=404, detail="Journal not found")
    from app.core.timeutils import utcnow

    journal.deleted_at = utcnow()
    journal.deleted_epoch = journal.id
    await db.commit()
    return None
