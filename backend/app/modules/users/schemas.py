from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    timezone: str
    is_active: bool
    created_at: datetime


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=64, pattern=r"^[\w\u4e00-\u9fff-]+$")
    password: str = Field(min_length=6, max_length=128)
    timezone: str = Field(default="UTC", max_length=64)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
