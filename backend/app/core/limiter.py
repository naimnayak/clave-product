"""Shared slowapi limiter. Keys on the signed-in user when known, otherwise on the client IP.

Counters are kept in RATE_LIMIT_STORAGE_URI: memory:// for one process, redis://... when scaled out.
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings


def _rate_limit_key(request: Request) -> str:
    uid = getattr(request.state, "uid", None)
    return f"uid:{uid}" if uid else f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_rate_limit_key, default_limits=[], storage_uri=get_settings().rate_limit_storage_uri)
