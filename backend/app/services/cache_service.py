"""
Cache Service
=============
A thin, failure-safe wrapper around redis.asyncio.

Design principles:
  - All cache operations are OPTIONAL. If Redis is unavailable, every method
    returns None / does nothing so the application degrades gracefully instead
    of crashing.
  - Cache keys follow the pattern:
      axiomate:{resource}:{workspace_id}:{...params}
  - All values are JSON-serialized before storage (using default=str so that
    date/UUID objects are automatically converted to strings).
  - The singleton `cache` instance is imported by endpoint modules.
"""

import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Async Redis cache with automatic serialisation/deserialisation.
    A single connection pool is created lazily on first use and reused for
    the lifetime of the process.
    """

    def __init__(self) -> None:
        self._client: Optional[aioredis.Redis] = None

    async def _get_client(self) -> aioredis.Redis:
        """Returns (and lazily creates) the shared Redis client."""
        if self._client is None:
            self._client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,      # Always return str, not bytes
                socket_connect_timeout=2,   # Fail fast if Redis is down
                socket_timeout=2,
            )
        return self._client

    # ── Public API ──────────────────────────────────────────────────────────────

    async def get(self, key: str) -> Optional[Any]:
        """
        Fetch a value from the cache.
        Returns the deserialised Python object, or None on a miss/error.
        """
        try:
            client = await self._get_client()
            raw = await client.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.warning("Cache GET error for key=%r: %s", key, exc)
            return None

    async def set(self, key: str, value: Any, ttl: int) -> None:
        """
        Store a value in the cache with an expiry time (in seconds).
        `default=str` handles dates, UUIDs, and other non-JSON types.
        """
        try:
            client = await self._get_client()
            serialised = json.dumps(value, default=str)
            await client.setex(key, ttl, serialised)
        except Exception as exc:
            logger.warning("Cache SET error for key=%r: %s", key, exc)

    async def delete(self, key: str) -> None:
        """Remove a single cache entry (used for targeted invalidation)."""
        try:
            client = await self._get_client()
            await client.delete(key)
        except Exception as exc:
            logger.warning("Cache DELETE error for key=%r: %s", key, exc)

    async def delete_pattern(self, pattern: str) -> None:
        """
        Delete all keys matching a Redis glob pattern.
        Example pattern: "axiomate:funnel:results:{workspace_id}:{funnel_id}:*"
        """
        try:
            client = await self._get_client()
            keys = await client.keys(pattern)
            if keys:
                await client.delete(*keys)
                logger.info("Cache: evicted %d keys matching %r", len(keys), pattern)
        except Exception as exc:
            logger.warning("Cache DELETE_PATTERN error for pattern=%r: %s", pattern, exc)

    async def invalidate_workspace(self, workspace_id: str) -> None:
        """
        Delete ALL cached results for a workspace at once.
        Uses Redis KEYS scan — acceptable for low-frequency invalidation calls
        (e.g. when a workspace is renamed or deleted).
        """
        try:
            client = await self._get_client()
            pattern = f"axiomate:*:{workspace_id}:*"
            keys = await client.keys(pattern)
            if keys:
                await client.delete(*keys)
                logger.info(
                    "Cache: invalidated %d keys for workspace %s",
                    len(keys), workspace_id,
                )
        except Exception as exc:
            logger.warning(
                "Cache invalidation error for workspace=%r: %s", workspace_id, exc
            )


# ── Singleton ──────────────────────────────────────────────────────────────────
# Import this in endpoint modules:  from app.services.cache_service import cache
cache = CacheService()
