"""Jobs catalog with per-user match scores, saved jobs, companies and live search (Apify)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pymongo.errors import DuplicateKeyError

from app.api.deps import stored_profile
from app.core.config import get_settings
from app.core.errors import ApiError, not_found
from app.core.limiter import limiter
from app.core.security import CurrentUser, get_current_user
from app.core.utils import iso, ok, utcnow
from app.db import mongo
from app.services.apify_jobs import search_jobs_parallel
from app.services.job_matching import to_detail, to_job, with_recommendations

router = APIRouter(tags=["Jobs"])


async def _catalog(uid: str) -> list[dict]:
    profile = await stored_profile(uid)
    jobs = [to_job(doc, profile) async for doc in mongo.jobs().find({"active": True}, {"detail": 0})]
    return with_recommendations(jobs)


@router.get("/jobs")
async def list_jobs(
    user: CurrentUser = Depends(get_current_user),
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
    jobs.sort(key=lambda j: j["postedDaysAgo"])
    start = (page - 1) * limit
    return ok(jobs[start : start + limit])


@router.get("/jobs/recommended")
async def recommended_jobs(user: CurrentUser = Depends(get_current_user), limit: int = Query(3, ge=1, le=20)):
    jobs = sorted((j for j in await _catalog(user.uid) if j["recommended"]), key=lambda j: -j["matchPercent"])
    return ok(jobs[:limit])


@router.get("/jobs/details")
async def job_details(user: CurrentUser = Depends(get_current_user)):
    """Long-form descriptions keyed by job id (Jobs page 'Why you match' panel)."""
    return ok({doc["_id"]: to_detail(doc) async for doc in mongo.jobs().find({"active": True}, {"detail": 1})})


@router.get("/jobs/saved")
async def saved_jobs(user: CurrentUser = Depends(get_current_user)):
    """Saved job ids mapped to when they were saved."""
    return ok({doc["jobId"]: iso(doc["savedAt"]) async for doc in mongo.saved_jobs().find({"uid": user.uid})})


@router.get("/jobs/search")
@limiter.limit("10/minute")
async def search_live_jobs(
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    q: str = Query(..., min_length=2, max_length=120),
    location: str = Query("", max_length=120),
    limit: int = Query(12, ge=1, le=30),
    sources: str = Query("indeed,naukri"),
):
    """Live listings from Indeed / Naukri (and LinkedIn when enabled) via Apify, cached for 6 hours."""
    if not get_settings().apify_api_token:
        raise ApiError(503, "SERVICE_UNAVAILABLE", "Live job search is not configured (APIFY_API_TOKEN).")
    source_list = sorted({s.strip().lower() for s in sources.split(",") if s.strip()})
    key = f"{q.strip().lower()}|{location.strip().lower()}|{limit}|{','.join(source_list)}"
    cached = await mongo.job_search_cache().find_one({"_id": key})
    if cached:
        return ok(cached["result"])
    try:
        result = await search_jobs_parallel(query=q.strip(), location=location.strip(), limit=limit, sources=source_list)
    except RuntimeError as exc:
        raise ApiError(502, "UPSTREAM_ERROR", f"Job search failed: {exc}") from exc
    await mongo.job_search_cache().update_one(
        {"_id": key}, {"$set": {"result": result, "createdAt": utcnow()}}, upsert=True
    )
    return ok(result)


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
    doc = await mongo.jobs().find_one({"_id": job_id, "active": True})
    if doc is None:
        raise not_found("Job")
    catalog = {j["id"]: j for j in await _catalog(user.uid)}
    company = await mongo.companies().find_one({"_id": doc.get("company", "")}, {"_id": 0})
    return ok({"job": catalog.get(job_id) or to_job(doc, None), "detail": to_detail(doc), "company": company})


@router.post("/jobs/{job_id}/save")
async def save_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
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
async def unsave_job(job_id: str, user: CurrentUser = Depends(get_current_user)):
    await mongo.saved_jobs().delete_one({"uid": user.uid, "jobId": job_id})
    return Response(status_code=204)


@router.get("/companies")
async def list_companies(user: CurrentUser = Depends(get_current_user)):
    """Company profiles keyed by company name, as the Job detail page looks them up."""
    return ok({doc["_id"]: {k: v for k, v in doc.items() if k != "_id"} async for doc in mongo.companies().find({})})
