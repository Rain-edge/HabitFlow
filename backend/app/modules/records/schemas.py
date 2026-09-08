from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class RecordCreate(BaseModel):
    habit_id: int
    record_date: date
    value_number: float | None = None
    value_text: str | None = Field(default=None, max_length=2000)
    value_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    is_completed: bool | None = None  # only meaningful for boolean habits
    note: str | None = Field(default=None, max_length=500)


class RecordUpdate(BaseModel):
    value_number: float | None = None
    value_text: str | None = Field(default=None, max_length=2000)
    value_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    is_completed: bool | None = None
    note: str | None = Field(default=None, max_length=500)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    habit_id: int
    record_date: date
    value_number: float | None
    value_text: str | None
    value_time: str | None
    is_completed: bool
    is_backfilled: bool
    note: str | None
    created_at: datetime
    updated_at: datetime
