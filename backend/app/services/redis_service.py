import json
import logging
from typing import Any, Optional
import redis

from app.config import settings

logger = logging.getLogger(__name__)

# Redis connection pool
_redis_pool: Optional[redis.Redis] = None


def get_redis() -> Optional[redis.Redis]:
    """Get Redis connection, returns None if Redis is unavailable."""
    global _redis_pool
    try:
        if _redis_pool is None:
            _redis_pool = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2
            )
            _redis_pool.ping()
        return _redis_pool
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis unavailable: {e}. Using fallback storage.")
        _redis_pool = None
        return None


def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set a value in cache with TTL in seconds."""
    try:
        r = get_redis()
        if r:
            r.setex(key, ttl, json.dumps(value, default=str))
            return True
    except Exception as e:
        logger.warning(f"Redis set failed: {e}")
    return False


def cache_get(key: str) -> Optional[Any]:
    """Get a value from cache."""
    try:
        r = get_redis()
        if r:
            value = r.get(key)
            if value:
                return json.loads(value)
    except Exception as e:
        logger.warning(f"Redis get failed: {e}")
    return None


def cache_delete(key: str) -> bool:
    """Delete a value from cache."""
    try:
        r = get_redis()
        if r:
            r.delete(key)
            return True
    except Exception as e:
        logger.warning(f"Redis delete failed: {e}")
    return False


# Automation state management
AUTOMATION_STATE_PREFIX = "automation:"


def set_automation_state(user_id: str, state: dict) -> bool:
    """Store automation state for a user."""
    key = f"{AUTOMATION_STATE_PREFIX}{user_id}"
    return cache_set(key, state, ttl=86400)  # 24 hour TTL


def get_automation_state(user_id: str) -> Optional[dict]:
    """Get automation state for a user."""
    key = f"{AUTOMATION_STATE_PREFIX}{user_id}"
    return cache_get(key)


def delete_automation_state(user_id: str) -> bool:
    """Delete automation state for a user."""
    key = f"{AUTOMATION_STATE_PREFIX}{user_id}"
    return cache_delete(key)


# Fallback in-memory storage for when Redis is unavailable
_fallback_storage: dict[str, dict] = {}


def get_automation_state_with_fallback(user_id: str) -> dict:
    """Get automation state with in-memory fallback."""
    state = get_automation_state(user_id)
    if state:
        return state
    return _fallback_storage.get(user_id, {
        "is_running": False,
        "jobs_queued": 0,
        "jobs_applied_today": 0,
        "last_run": None
    })


def set_automation_state_with_fallback(user_id: str, state: dict) -> None:
    """Set automation state with in-memory fallback."""
    if not set_automation_state(user_id, state):
        _fallback_storage[user_id] = state
