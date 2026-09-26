"""Shared router helpers."""

from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from app.core.config import get_settings
from app.core.errors import ApiError
from app.db import mongo
from app.services import quota
from app.services.ai_client import AIResponseError, AIUnavailableError

T = TypeVar("T")

AI_LIMIT = get_settings().ai_rate_limit


async def run_ai(awaitable: Awaitable[T]) -> T:
    """Maps AI provider failures onto the documented AI_GENERATION_FAILED error."""
    try:
        return await awaitable
    except AIUnavailableError as exc:
        raise ApiError(503, "AI_GENERATION_FAILED", str(exc) or "AI service temporarily unavailable, please retry.") from exc
    except AIResponseError as exc:
        raise ApiError(502, "AI_GENERATION_FAILED", str(exc) or "AI service returned an unexpected response, please retry.") from exc


async def ai_action(uid: str, call: Callable[[], Awaitable[T]]) -> T:
    """One user-visible AI action: checks the daily allowance, runs the call, refunds it on failure."""
    await quota.consume_ai_action(uid)
    try:
        return await run_ai(call())
    except Exception:
        await quota.refund_ai_action(uid)
        raise


async def stored_profile(uid: str) -> dict[str, Any] | None:
    doc = await mongo.profiles().find_one({"_id": uid})
    return doc.get("data") if doc else None
