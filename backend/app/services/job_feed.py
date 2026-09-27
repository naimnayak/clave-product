"""Personal job feed for Clave Pro users.

Searches are built from what the user gave us: the titles of their saved job descriptions (newest
first), their latest resume's target role and their Career Profile's target roles. Listings land in the
shared `jobs` catalog (deduplicated across users) and are ranked per user by services/job_matching.py.

Cost controls (all configurable in backend/.env):
- automatic refresh every JOB_FEED_REFRESH_DAYS, at most JOB_FEED_SCHEDULED_PER_MONTH times a month,
- one search per new job description, at most JOB_FEED_JD_SEARCHES_PER_MONTH a month,
- identical searches (same role, city and boards) reuse results for JOB_FEED_CACHE_HOURS,
- a global monthly listing cap in services/apify_jobs.py.
"""

import asyncio
import logging
from datetime import timedelta
from typing import Any, Literal

from app.core.config import get_settings
from app.core.utils import iso, utcnow
from app.db import mongo
from app.services import job_ingest, plans
from app.services import resume_logic as rl
from app.services.ai_client import is_configured as ai_configured
from app.services.apify_jobs import ApifyBudgetExceeded, search_jobs_parallel

logger = logging.getLogger(__name__)

Reason = Literal["scheduled", "jd", "upgrade", "first_visit"]
_RUN_LEASE = timedelta(minutes=10)
_MAX_QUERIES = 4
_background: set[asyncio.Task] = set()


def enabled() -> bool:
    return bool(get_settings().apify_api_token) and ai_configured()


def _sources() -> list[str]:
    return [s.strip().lower() for s in get_settings().job_feed_sources.split(",") if s.strip()]


def month_key(uid: str) -> str:
    return f"user:{uid}:{utcnow().strftime('%Y-%m')}"


async def _location(profile: dict[str, Any]) -> str:
    preferred = profile.get("preferredLocations") or []
    return (preferred[0] if preferred else "") or profile.get("location") or get_settings().job_ingest_location


async def user_queries(uid: str) -> tuple[list[str], str]:
    """Search terms for this user, most specific first, and the location to search in."""
    profile = ((await mongo.profiles().find_one({"_id": uid})) or {}).get("data") or {}
    jds = mongo.job_descriptions().find({"uid": uid, "title": {"$nin": [None, ""]}}, {"title": 1}).sort("lastUsedAt", -1).limit(3)
    titles = [doc["title"] async for doc in jds]
    resume = await mongo.resumes().find_one({"uid": uid, "targetRole": {"$nin": [None, ""]}}, {"targetRole": 1}, sort=[("updatedAt", -1)])
    if resume:
        titles.append(resume["targetRole"])
    titles += profile.get("targetRoles") or []
    return rl.dedupe(titles, _MAX_QUERIES), await _location(profile)


async def usage(uid: str) -> dict[str, int]:
    doc = await mongo.job_feed_usage().find_one({"_id": month_key(uid)}) or {}
    return {"scheduled": int(doc.get("scheduled", 0)), "jd": int(doc.get("jd", 0)), "results": int(doc.get("results", 0))}


async def status(uid: str) -> dict[str, Any]:
    settings = get_settings()
    state = ((await mongo.users().find_one({"_id": uid}, {"jobFeed": 1})) or {}).get("jobFeed") or {}
    used = await usage(uid)
    last = state.get("lastRefreshAt")
    queries, location = await user_queries(uid)
    return {
        "enabled": enabled(),
        "running": bool(state.get("runningUntil") and state["runningUntil"] > utcnow()),
        "lastRefreshAt": iso(last),
        "nextRefreshAt": iso(last + timedelta(days=settings.job_feed_refresh_days)) if last else None,
        "scheduledLeft": max(0, settings.job_feed_scheduled_per_month - used["scheduled"]),
        "jdSearchesLeft": max(0, settings.job_feed_jd_searches_per_month - used["jd"]),
        "queries": queries,
        "location": location,
        "lastError": state.get("lastError") or None,
    }


async def _claim(uid: str) -> bool:
    now = utcnow()
    doc = await mongo.users().find_one_and_update(
        {"_id": uid, "$or": [{"jobFeed.runningUntil": {"$lt": now}}, {"jobFeed.runningUntil": {"$exists": False}}]},
        {"$set": {"jobFeed.runningUntil": now + _RUN_LEASE}},
    )
    return doc is not None


async def _cached_search(query: str, location: str, sources: list[str]) -> tuple[list[dict[str, Any]], bool]:
    """Listings for this search, from the shared cache when someone ran it recently. Returns (listings, from_cache)."""
    settings = get_settings()
    key = f"feed|{query.strip().lower()}|{location.strip().lower()}|{','.join(sorted(sources))}"
    fresh_after = utcnow() - timedelta(hours=settings.job_feed_cache_hours)
    cached = await mongo.job_search_cache().find_one({"_id": key, "createdAt": {"$gt": fresh_after}})
    if cached:
        return cached["result"].get("jobs", []), True
    result = await search_jobs_parallel(query=query, location=location, limit=settings.job_feed_results_per_search, sources=sources)
    await mongo.job_search_cache().update_one({"_id": key}, {"$set": {"result": result, "createdAt": utcnow()}}, upsert=True)
    return result.get("jobs", []), False


async def refresh(uid: str, reason: Reason, jd_id: str | None = None) -> dict[str, Any]:
    """One personal search. Returns a summary; never raises for budget or upstream problems."""
    settings = get_settings()
    summary: dict[str, Any] = {"uid": uid, "reason": reason, "created": 0, "refreshed": 0, "skipped": 0, "errors": []}
    if not enabled():
        summary["errors"].append("job feed is not configured (APIFY_API_TOKEN / AI model)")
        return summary
    if settings.enforce_plan_limits and not await _is_pro(uid):
        summary["errors"].append("not a Pro user")
        return summary

    kind = "jd" if reason == "jd" else "scheduled"
    cap = settings.job_feed_jd_searches_per_month if kind == "jd" else settings.job_feed_scheduled_per_month
    if (await usage(uid))[kind] >= cap:
        summary["errors"].append(f"monthly {kind} search limit reached")
        return summary

    queries, location = await user_queries(uid)
    if kind == "jd" and jd_id:
        jd = await mongo.job_descriptions().find_one({"_id": jd_id, "uid": uid}, {"title": 1, "keywords": 1})
        jd_query = (jd or {}).get("title") or " ".join(((jd or {}).get("keywords") or [])[:3])
        queries = rl.dedupe([jd_query, *queries], _MAX_QUERIES) if jd_query else queries
    if not queries:
        summary["errors"].append("no resume, job description or target role to search for yet")
        return summary
    if not await _claim(uid):
        summary["errors"].append("a refresh is already running")
        return summary

    state = ((await mongo.users().find_one({"_id": uid}, {"jobFeed": 1})) or {}).get("jobFeed") or {}
    cursor = int(state.get("cursor", 0))
    query = queries[0] if kind == "jd" else queries[cursor % len(queries)]
    summary["query"], summary["location"] = query, location
    error = None
    try:
        listings, from_cache = await _cached_search(query, location, _sources())
        summary["fromCache"] = from_cache
        if not from_cache:
            await mongo.job_feed_usage().update_one(
                {"_id": month_key(uid)}, {"$inc": {kind: 1, "results": len(listings)}, "$setOnInsert": {"uid": uid}}, upsert=True
            )
        new_docs = await job_ingest.store_listings(listings, summary, query)
        await job_ingest.retire_demo_jobs(summary)
        await job_ingest.notify_matches(new_docs, [uid])
    except ApifyBudgetExceeded as exc:
        error = str(exc)
        logger.warning("Job feed skipped for %s: %s", uid, exc)
    except RuntimeError as exc:
        error = f"search failed: {exc}"
        logger.warning("Job feed search failed for %s: %s", uid, exc)
    finally:
        updates: dict[str, Any] = {"jobFeed.runningUntil": utcnow(), "jobFeed.lastQuery": query, "jobFeed.lastError": error}
        if kind == "scheduled":
            updates |= {"jobFeed.lastRefreshAt": utcnow(), "jobFeed.cursor": cursor + 1}
        await mongo.users().update_one({"_id": uid}, {"$set": updates})
    if error:
        summary["errors"].append(error)
    logger.info("Job feed %s for %s: %s", reason, uid, {k: v for k, v in summary.items() if k != "uid"})
    return summary


async def _is_pro(uid: str) -> bool:
    doc = await mongo.users().find_one({"_id": uid}, {"subscription": 1})
    return plans.is_pro((doc or {}).get("subscription"))


def refresh_in_background(uid: str, reason: Reason, jd_id: str | None = None) -> None:
    """Fire-and-forget refresh so the request that triggered it returns immediately."""
    if not enabled():
        return

    async def run() -> None:
        try:
            await refresh(uid, reason, jd_id)
        except Exception:
            logger.exception("Background job feed refresh failed for %s", uid)

    task = asyncio.create_task(run())
    _background.add(task)
    task.add_done_callback(_background.discard)


async def run_scheduled(max_users: int = 50) -> int:
    """Refreshes Pro users whose feed is due. Called by the API's maintenance loop."""
    if not enabled():
        return 0
    due_before = utcnow() - timedelta(days=get_settings().job_feed_refresh_days)
    query = {
        **job_ingest.pro_user_filter(),
        "$or": [{"jobFeed.lastRefreshAt": {"$lt": due_before}}, {"jobFeed.lastRefreshAt": {"$exists": False}}],
    }
    refreshed = 0
    async for doc in mongo.users().find(query, {"_id": 1}).limit(max_users):
        summary = await refresh(doc["_id"], "scheduled")
        refreshed += int("query" in summary)
    await job_ingest.expire_old_jobs({})
    return refreshed
