from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.habit_logic import RECORD_TYPES, SCHEDULE_TYPES


class HabitBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None
    icon: str = Field(default="🌱", max_length=16)
    color: str = Field(default="#4F8EF7", max_length=16)
    category: str = Field(default="general", max_length=50)

    record_type: str = Field(default="boolean")
    target_value: float | None = None
    unit: str | None = Field(default=None, max_length=20)
    select_options: list[str] | None = None

    schedule_type: str = Field(default="daily")
    weekly_target: int | None = Field(default=None, ge=1, le=7)
    weekly_days: list[int] | None = None  # 0=Monday ... 6=Sunday

    start_date: date | None = None
    end_date: date | None = None

    reminder_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    reminder_enabled: bool = False
    is_active: bool = True
    show_on_homepage: bool = True
    counts_for_daily: bool = True
    allow_backfill: bool = True

    @field_validator("record_type")
    @classmethod
    def _check_record_type(cls, v: str) -> str:
        if v not in RECORD_TYPES:
            raise ValueError(f"record_type must be one of {RECORD_TYPES}")
        return v

    @field_validator("schedule_type")
    @classmethod
    def _check_schedule_type(cls, v: str) -> str:
        if v not in SCHEDULE_TYPES:
            raise ValueError(f"schedule_type must be one of {SCHEDULE_TYPES}")
        return v

    @field_validator("weekly_days")
    @classmethod
    def _check_weekly_days(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if not v or any(d not in range(7) for d in v):
            raise ValueError("weekly_days must be a non-empty list of 0-6")
        return sorted(set(v))

    @model_validator(mode="after")
    def _check_rules(self):
        if self.schedule_type == "weekly_count" and not self.weekly_target:
            raise ValueError("weekly_target is required for weekly_count schedule")
        if self.schedule_type == "weekly_days" and not self.weekly_days:
            raise ValueError("weekly_days is required for weekly_days schedule")
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("end_date must be after start_date")
        if self.record_type == "select" and not self.select_options:
            raise ValueError("select_options is required for select type")
        return self


class HabitCreate(HabitBase):
    pass


class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=16)
    color: str | None = Field(default=None, max_length=16)
    category: str | None = Field(default=None, max_length=50)
    target_value: float | None = None
    unit: str | None = Field(default=None, max_length=20)
    select_options: list[str] | None = None
    weekly_target: int | None = Field(default=None, ge=1, le=7)
    weekly_days: list[int] | None = None
    end_date: date | None = None
    reminder_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    reminder_enabled: bool | None = None
    is_active: bool | None = None
    show_on_homepage: bool | None = None
    counts_for_daily: bool | None = None
    allow_backfill: bool | None = None

    @field_validator("weekly_days")
    @classmethod
    def _check_weekly_days(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        if not v or any(d not in range(7) for d in v):
            raise ValueError("weekly_days must be a non-empty list of 0-6")
        return sorted(set(v))


class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    icon: str
    color: str
    category: str
    record_type: str
    target_value: float | None
    unit: str | None
    select_options: list[str] | None
    schedule_type: str
    weekly_target: int | None
    weekly_days: list[int] | None
    start_date: date
    end_date: date | None
    reminder_time: str | None
    reminder_enabled: bool
    is_active: bool
    show_on_homepage: bool
    counts_for_daily: bool
    allow_backfill: bool
    created_at: datetime
    deleted_at: datetime | None
