from datetime import date

from zoneinfo import ZoneInfo

from app.core.timeutils import utcnow


def user_today(timezone_name: str | None) -> date:
    """The user's current local date, falling back to server date."""
    if timezone_name:
        try:
            return utcnow().astimezone(ZoneInfo(timezone_name)).date()
        except Exception:
            pass
    return date.today()
