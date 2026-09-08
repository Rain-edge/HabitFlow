from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.modules.users.models import User
from app.modules.users.schemas import UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=64)
    timezone: str | None = Field(default=None, max_length=64)


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6, max_length=128)


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.username is not None:
        user.username = payload.username
    if payload.timezone is not None:
        user.timezone = payload.timezone
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/password", status_code=204)
async def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return None
