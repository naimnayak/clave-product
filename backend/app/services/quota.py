"""Plan entitlements and server-side quotas (developer-handoff/07-SUBSCRIPTION-USAGE.md).

Limits come from the `plans` collection (services/plans.py):
- Free: a lifetime resume allowance (deleting doesn't give it back), also capped per device by
  free_resume_guard, a daily AI allowance, a daily chat allowance and a number of mock interviews.
- Single Resume: +1 resume credit per purchase.
- Clave Pro (`monthly`): unlimited resumes, higher daily caps, jobs and unlimited mock interviews.
"""

from datetime import timedelta
from typing import Any, Literal

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.utils import iso, utcnow
from app.db import mongo
from app.services import free_resume_guard, plans

AiKind = Literal["ai", "chat"]


async def _upgrade_options() -> dict[str, Any]:
    return {k: v for k, v in (await plans.public_catalog()).items() if k != "free"}


async def entitlements(user_doc: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    subscription = user_doc.get("subscription") or {}
    usage = user_doc.get("usage") or {}
    pro = plans.is_pro(subscription)
    plan = await plans.plan_for(user_doc)
    free = await plans.get_plan("free")
    created = int(usage.get("resumesCreated", 0))
    balance = int(subscription.get("singleResumesBalance", 0))
    allowance = plans.limit(free, "resumes") or 0
    can_create = (not settings.enforce_plan_limits) or pro or created < allowance or balance > 0
    return {
        "plan": plans.PRO_PLAN if pro else "free",
        "planName": plan.get("name", ""),
        "isPro": pro,
        "status": "active" if pro or subscription.get("plan") != plans.PRO_PLAN else "expired",
        "currentPeriodEnd": iso(subscription.get("currentPeriodEnd")),
        "resumesCreated": created,
        "resumesAllowance": allowance,
        "singleResumesBalance": balance,
        "isUnlimited": pro,
        "canCreateResume": can_create,
        "limitsEnforced": settings.enforce_plan_limits,
        "limits": plan.get("limits") or {},
        "features": plan.get("features") or {},
        "mockInterviewsUsed": int(usage.get("mockInterviews", 0)),
    }


async def plan_limit_error(message: str | None = None) -> ApiError:
    free = await plans.get_plan("free")
    allowance = plans.limit(free, "resumes") or 0
    return ApiError(
        402,
        "PLAN_LIMIT_REACHED",
        message
        or f"You have used your {allowance} free resume{'s' if allowance != 1 else ''}. "
        "Upgrade to Clave Pro or buy a single resume credit to create more.",
        plans=await _upgrade_options(),
    )


async def pro_required(what: str) -> ApiError:
    return ApiError(402, "PRO_REQUIRED", f"{what} is part of Clave Pro. Upgrade to unlock it.", plans=await _upgrade_options())


async def is_pro_user(uid: str) -> bool:
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1})
    return plans.is_pro((doc or {}).get("subscription"))


async def require_pro(uid: str, what: str) -> None:
    if get_settings().enforce_plan_limits and not await is_pro_user(uid):
        raise await pro_required(what)


_DEVICE_MESSAGE = (
    "This device has already used its free resumes. Upgrade to Clave Pro or buy a single resume credit to create more."
)


async def assert_can_create(uid: str, request: Request | None = None) -> None:
    """Cheap pre-check before spending AI tokens on something the user cannot save."""
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1, "usage": 1}) or {}
    ent = await entitlements(doc)
    if not ent["canCreateResume"]:
        raise await plan_limit_error()
    uses_free = ent["limitsEnforced"] and not ent["isPro"] and ent["singleResumesBalance"] == 0
    if uses_free and request is not None and get_settings().free_resume_guard_enabled:
        if (await free_resume_guard.evaluate(request, uid)).blocked:
            raise await plan_limit_error(_DEVICE_MESSAGE)


async def consume_resume_credit(uid: str, request: Request | None = None) -> str:
    """Atomically records a resume creation against the user's plan. Returns what was used."""
    settings = get_settings()
    users = mongo.users()
    inc = {"$inc": {"usage.resumesCreated": 1}}

    if not settings.enforce_plan_limits:
        await users.update_one({"_id": uid}, inc)
        return "unenforced"

    now = utcnow()
    if await users.find_one_and_update(
        {"_id": uid, "subscription.plan": plans.PRO_PLAN, "subscription.currentPeriodEnd": {"$gt": now}}, inc
    ):
        return plans.PRO_PLAN

    allowance = plans.limit(await plans.get_plan("free"), "resumes") or 0
    guard = None
    if request is not None and settings.free_resume_guard_enabled:
        guard = await free_resume_guard.evaluate(request, uid)

    if not (guard and guard.blocked) and await users.find_one_and_update(
        {"_id": uid, "$or": [{"usage.resumesCreated": {"$lt": allowance}}, {"usage.resumesCreated": {"$exists": False}}]},
        inc,
    ):
        if guard:
            await free_resume_guard.record(uid, guard)
        return "free"

    if await users.find_one_and_update(
        {"_id": uid, "subscription.singleResumesBalance": {"$gt": 0}},
        {"$inc": {"usage.resumesCreated": 1, "subscription.singleResumesBalance": -1}},
    ):
        return "credit"

    raise await plan_limit_error(_DEVICE_MESSAGE if guard and guard.blocked else None)


# ─── Mock interviews ────────────────────────────────────────────────────────────


async def consume_mock_interview(uid: str) -> None:
    """Free users get a set number of mock interviews; Pro is unlimited. Counted when a session starts."""
    users = mongo.users()
    inc = {"$inc": {"usage.mockInterviews": 1}}
    if not get_settings().enforce_plan_limits or await is_pro_user(uid):
        await users.update_one({"_id": uid}, inc)
        return
    allowed = plans.limit(await plans.get_plan("free"), "mockInterviews") or 0
    if not await users.find_one_and_update(
        {"_id": uid, "$or": [{"usage.mockInterviews": {"$lt": allowed}}, {"usage.mockInterviews": {"$exists": False}}]}, inc
    ):
        raise await pro_required("Unlimited mock interviews")


async def refund_mock_interview(uid: str) -> None:
    await mongo.users().update_one({"_id": uid, "usage.mockInterviews": {"$gt": 0}}, {"$inc": {"usage.mockInterviews": -1}})


# ─── Daily AI actions and chat messages ─────────────────────────────────────────

_FIELD = {"ai": "count", "chat": "chat"}
_LIMIT_KEY = {"ai": "aiDaily", "chat": "chatDaily"}


def _ai_key(uid: str) -> str:
    return f"{uid}:{utcnow().strftime('%Y-%m-%d')}"


async def ai_daily_status(uid: str) -> dict[str, Any]:
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1})
    plan = await plans.plan_for(doc)
    usage = await mongo.ai_usage().find_one({"_id": _ai_key(uid)}) or {}
    return {
        "limit": plans.limit(plan, "aiDaily") or 0,
        "used": int(usage.get("count", 0)),
        "chatLimit": plans.limit(plan, "chatDaily") or 0,
        "chatUsed": int(usage.get("chat", 0)),
        "isPro": plans.is_pro((doc or {}).get("subscription")),
    }


async def consume_ai_action(uid: str, kind: AiKind = "ai") -> None:
    """Counts one AI action (or chat message) for today and blocks once the plan's daily cap is used up."""
    status = await ai_daily_status(uid)
    used, cap = (status["used"], status["limit"]) if kind == "ai" else (status["chatUsed"], status["chatLimit"])
    if used >= cap:
        what = "AI actions" if kind == "ai" else "assistant messages"
        raise ApiError(
            429,
            "AI_DAILY_LIMIT_REACHED",
            f"You've used today's {cap} {what}. They reset at midnight UTC" + ("." if status["isPro"] else ", or upgrade to Clave Pro for more."),
        )
    await mongo.ai_usage().update_one(
        {"_id": _ai_key(uid)},
        {"$inc": {_FIELD[kind]: 1}, "$setOnInsert": {"uid": uid, "expireAt": utcnow() + timedelta(days=2)}},
        upsert=True,
    )


async def refund_ai_action(uid: str, kind: AiKind = "ai") -> None:
    """Failed AI calls don't count against the allowance."""
    field = _FIELD[kind]
    await mongo.ai_usage().update_one({"_id": _ai_key(uid), field: {"$gt": 0}}, {"$inc": {field: -1}})
