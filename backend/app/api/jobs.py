"""Jobs: a Clave Pro feature.

Pro users get the catalog ranked against their resume and saved job descriptions, fed by personal
searches (services/job_feed.py). Free users get GET /jobs/preview: their top matches with the company
and apply link hidden. Every other jobs endpoint returns 402 PRO_REQUIRED for Free users.
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.errors import ApiError, not_found
from app.core.limiter import limiter
from app.core.security import CurrentUser, get_current_user
from app.core.utils import iso, ok, utcnow
from app.db import mongo
from app.services import job_feed, quota
from app.services.apify_jobs import ApifyBudgetExceeded, search_jobs_parallel
from app.services.job_matching import load_signals, to_detail, to_job, with_recommendations

router = APIRouter(tags=["Jobs"])
PREVIEW_COUNT = 3
_HIDDEN = "Hidden until you upgrade"


async def _catalog(uid: str) -> list[dict]:
    signals = await load_signals(uid)
    jobs = [to_job(doc, signals) async for doc in mongo.jobs().find({"active": True}, {"detail": 0})]
    return with_recommendations(jobs)


async def _pro(user: CurrentUser) -> CurrentUser:
    await quota.require_pro(user.uid, "Personalised job listings")
    return user


async def pro_user(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency for Pro-only routes. Also starts a Pro user's first feed refresh."""
    await _pro(user)
    state = ((await mongo.users().find_one({"_id": user.uid}, {"jobFeed": 1})) or {}).get("jobFeed") or {}
    if not state.get("lastRefreshAt") and not state.get("runningUntil"):
        job_feed.refresh_in_background(user.uid, "first_visit")
    return user


@router.get("/jobs/preview")
async def jobs_preview(user: CurrentUser = Depends(get_current_user)):
    """Top matches for everyone. Free users see them with the company and apply link hidden."""
    pro = await quota.is_pro_user(user.uid)
    ranked = sorted(await _catalog(user.uid), key=lambda j: (-j["matchPercent"], j["postedDaysAgo"]))
    matches = [j for j in ranked if j["matchPercent"] > 0]
    top = matches[:PREVIEW_COUNT]
    if not pro:
        top = [{**{k: v for k, v in j.items() if k not in {"applyUrl", "salary"}}, "company": _HIDDEN, "locked": True} for j in top]
    return ok({"jobs": top, "totalMatches": len(matches), "totalJobs": len(ranked), "isPro": pro})


@router.get("/jobs/feed")
async def feed_status(user: CurrentUser = Depends(pro_user)):
    """When the personal feed last refreshed, what it searches for and the searches left this month."""
    return ok(await job_feed.status(user.uid))


@router.get("/jobs")
async def list_jobs(
    user: CurrentUser = Depends(pro_user),
    q: str = Query("", max_length=200),
    work_type: Literal["remote", "hybrid", "onsite"] | None = Query(None, alias="workType"),
    level: Literal["internship", "entry", "junior", "mid"] | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
):
    jobs = await _catalog(user.uid)
    needle = q.strip().lower()
    if needle:
        jobs = [
            j for j in jobs
            if needle in " ".join([j["title"], j["company"], j["city"], j["roleType"], *j["skills"]]).lower()
        ]
    if work_type:
        jobs = [j for j in jobs if j["workType"] == work_type]
    if level:
        jobs = [j for j in jobs if j["level"] == level]
    jobs.sort(key=lambda j: (-j["matchPercent"], j["postedDaysAgo"]))
    start = (page - 1) * limit
    return ok(jobs[start : start + limit])


@router.get("/jobs/recommended")
async def recommended_jobs(user: CurrentUser = Depends(pro_user), limit: int = Query(3, ge=1, le=20)):
    jobs = sorted((j for j in await _catalog(user.uid) if j["recommended"]), key=lambda j: -j["matchPercent"])
    return ok(jobs[:limit])


@router.get("/jobs/details")
async def job_details(user: CurrentUser = Depends(pro_user)):
    """Long-form descriptions keyed by job id (Jobs page 'Why you match' panel)."""
    return ok({doc["_id"]: to_detail(doc) async for doc in mongo.jobs().find({"active": True}, {"detail": 1})})


@router.get("/jobs/saved")
async def saved_jobs(user: CurrentUser = Depends(pro_user)):
    """Saved job ids mapped to when they were saved."""
    return ok({doc["jobId"]: iso(doc["savedAt"]) async for doc in mongo.saved_jobs().find({"uid": user.uid})})


@router.get("/jobs/search")
@limiter.limit("10/minute")
async def search_live_jobs(
    request: Request,
    user: CurrentUser = Depends(pro_user),
    q: str = Query(..., min_length=2, max_length=120),
    location: str = Query("", max_length=120),
    limit: int = Query(12, ge=1, le=30),
    sources: str = Query("indeed,naukri"),
):
    """Raw live listings via Apify, cached. Uncached searches use the user's monthly job-description searches."""
    if not job_feed.enabled():
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Live job search is not configured (APIFY_API_TOKEN).")
    source_list = sorted({s.strip().lower() for s in sources.split(",") if s.strip()})
    key = f"{q.strip().lower()}|{location.strip().lower()}|{limit}|{','.join(source_list)}"
    cached = await mongo.job_search_cache().find_one({"_id": key})
    if cached:
        return ok(cached["result"])
    if (await job_feed.usage(user.uid))["jd"] >= get_settings().job_feed_jd_searches_per_month:
        raise ApiError(429, "SEARCH_LIMIT_REACHED", "You've used this month's live searches. Your feed still refreshes automatically.")
    try:
        result = await search_jobs_parallel(query=q.strip(), location=location.strip(), limit=limit, sources=source_list)
    except ApifyBudgetExceeded as exc:
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Live search is paused for the rest of the month.") from exc
    except RuntimeError as exc:
        raise ApiError(502, "UPSTREAM_ERROR", f"Job search failed: {exc}") from exc
    await mongo.job_feed_usage().update_one({"_id": job_feed.month_key(user.uid)}, {"$inc": {"jd": 1}}, upsert=True)
    await mongo.job_search_cache().update_one(
        {"_id": key}, {"$set": {"result": result, "createdAt": utcnow()}}, upsert=True
    )
    return ok(result)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: CurrentUser = Depends(pro_user)):
    doc = await mongo.jobs().find_one({"_id": job_id, "active": True})
    if doc is None:
        raise not_found("Job")
    job = with_recommendations([to_job(doc, await load_signals(user.uid))])[0]
    company = await mongo.companies().find_one({"_id": doc.get("company", "")}, {"_id": 0})
    return ok({"job": job, "detail": to_detail(doc), "company": company})


@router.post("/jobs/{job_id}/save")
async def save_job(job_id: str, user: CurrentUser = Depends(pro_user)):
    if not await mongo.jobs().find_one({"_id": job_id}, {"_id": 1}):
        raise not_found("Job")
    now = utcnow()
    try:
        await mongo.saved_jobs().update_one(
            {"uid": user.uid, "jobId": job_id}, {"$setOnInsert": {"savedAt": now}}, upsert=True
        )
    except DuplicateKeyError:
        pass  # concurrent save of the same job: already saved
    doc = await mongo.saved_jobs().find_one({"uid": user.uid, "jobId": job_id})
    return ok({"jobId": job_id, "savedAt": iso(doc["savedAt"] if doc else now)}, "Job saved")


@router.delete("/jobs/{job_id}/save", status_code=204)
async def unsave_job(job_id: str, user: CurrentUser = Depends(pro_user)):
    await mongo.saved_jobs().delete_one({"uid": user.uid, "jobId": job_id})
    return Response(status_code=204)


@router.get("/companies")
async def list_companies(user: CurrentUser = Depends(pro_user)):
    """Company profiles keyed by company name, as the Job detail page looks them up."""
    return ok({doc["_id"]: {k: v for k, v in doc.items() if k != "_id"} async for doc in mongo.companies().find({})})
