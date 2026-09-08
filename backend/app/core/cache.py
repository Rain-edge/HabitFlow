"""Optional Redis cache with graceful in-memory fallback.

Redis is used as a best-effort cache (e.g. today's dashboard). If Redis is
unavailable the system keeps working without caching.
"""

from __future__ import annotations

import json
import time
from typing import Any

from app.core.config import settings

_client = None
if settings.redis_url:
    try:
        import redis.asyncio as aioredis

        _client = aioredis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        _client = None

_memory: dict[str, tuple[float, str]] = {}


async def cache_get(key: str) -> Any | None:
    try:
        if _client is not None:
            raw = await _client.get(key)
        else:
            entry = _memory.get(key)
            raw = entry[1] if entry and entry[0] > time.time() else None
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 60) -> None:
    try:
        raw = json.dumps(value)
        if _client is not None:
            await _client.set(key, raw, ex=ttl)
        else:
            _memory[key] = (time.time() + ttl, raw)
    except Exception:
        pass


async def cache_delete_prefix(prefix: str) -> None:
    try:
        if _client is not None:
            cursor = 0
            while True:
                cursor, keys = await _client.scan(cursor, match=f"{prefix}*", count=200)
                if keys:
                    await _client.delete(*keys)
                if cursor == 0:
                    break
        else:
            for k in [k for k in _memory if k.startswith(prefix)]:
                _memory.pop(k, None)
    except Exception:
        pass
