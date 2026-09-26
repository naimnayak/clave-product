"""Job feed: imports live listings (Apify), structures them with the AI model and keeps the catalog fresh.

Run from cron with `python -m app.cli.ingest_jobs`, or set JOB_INGEST_INTERVAL_HOURS to run inside the API.
A lease in `ingest_runs` makes sure only one process ingests at a time.
"""

import hashlib
import html
import json
import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo
from app.services import resume_logic as rl
from app.services.ai_client import AIResponseError, AIUnavailableError, generate_structured, is_configured
from app.services.apify_jobs import search_jobs_parallel
from app.services.job_matching import match_percent
from app.services.notifications import notify

logger = logging.getLogger(__name__)

DEFAULT_QUERIES = ["Software Developer", "Frontend Developer", "Data Analyst", "Product Designer", "Business Analyst", "Digital Marketing"]
ROLE_FAMILIES = [
    "Frontend Engineering", "Backend Engineering", "Full Stack Engineering", "Mobile Engineering", "Data & Analytics",
    "Machine Learning", "DevOps & Cloud", "QA & Testing", "Product Design", "UX/UI Design", "Product Management",
    "Marketing", "Sales", "Finance", "Operations", "Human Resources", "Other",
]
_BATCH = 5
_LEASE = timedelta(minutes=30)


class _Listing(BaseModel):
    index: int
    isJobPosting: bool
    title: str
    company: str
    city: str
    workType: Literal["remote", "hybrid", "onsite", "unknown"]
    level: Literal["internship", "entry", "junior", "mid", "senior"]
    roleType: str
    experience: str
    skills: list[str]
    salary: str
    jobType: str
    about: str
    responsibilities: list[str]
    requirements: list[str]
    niceToHave: list[str]
    stretchSkill: str


class _Batch(BaseModel):
    jobs: list[_Listing]


_PROMPT = """Structure these job listings for a job board aimed at students, freshers and early-career candidates.
Use ONLY what each listing says. Use "" or [] when something isn't stated; never guess salaries or company facts.

For each listing (keep its index):
- isJobPosting: false for search pages, articles, resume tips or anything that is not one concrete job.
- title, company: as written. city: the city only (use "Remote" for fully remote jobs).
- workType: remote, hybrid or onsite when stated, otherwise unknown.
- level: internship, entry (0-1 yrs), junior (1-3 yrs), mid (3-5 yrs) or senior (5+ yrs), from the title and requirements.
- roleType: exactly one of {families}.
- experience: required experience as written, e.g. "0–2 yrs" or "Internship", otherwise "".
- skills: up to 8 key skills or tools, 1-3 words each.
- salary: as written, otherwise "". jobType: e.g. "Full-time", "Internship", "Contract", otherwise "".
- about: 2-4 sentences summarising the role, in plain words.
- responsibilities, requirements, niceToHave: short bullet sentences taken from the listing.
- stretchSkill: one skill from the listing a strong candidate would still want to build, otherwise "".

LISTINGS (JSON):
{listings}"""


_TAG = re.compile(r"<[^>]+>")


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAG.sub(" ", text))).strip()


def _posted_at(value: str):
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            parsed = datetime.strptime(value[:26], fmt).replace(tzinfo=UTC)
            return min(parsed, utcnow())
        except (ValueError, TypeError):
            continue
    return utcnow()


def _external_id(url: str, source: str, title: str, company: str) -> str:
    key = url.strip().lower() or f"{source}|{title}|{company}".lower()
    return hashlib.sha1(key.encode()).hexdigest()


async def _acquire_lease() -> bool:
    now = utcnow()
    try:
        doc = await mongo.ingest_runs().find_one_and_update(
            {"_id": "lease", "$or": [{"until": {"$lt": now}}, {"until": {"$exists": False}}]},
            {"$set": {"until": now + _LEASE}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        return False  # another process holds the lease
    return doc is not None


async def _release_lease() -> None:
    await mongo.ingest_runs().update_one({"_id": "lease"}, {"$set": {"until": utcnow()}})


async def pick_queries() -> list[str]:
    settings = get_settings()
    if settings.job_ingest_queries.strip():
        return rl.dedupe(settings.job_ingest_queries.split(","), settings.job_ingest_max_queries)
    pipeline = [
        {"$unwind": "$data.targetRoles"},
        {"$group": {"_id": {"$toLower": "$data.targetRoles"}, "label": {"$first": "$data.targetRoles"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": settings.job_ingest_max_queries},
    ]
    roles = [row["label"] async for row in await mongo.profiles().aggregate(pipeline)]
    # Users' own target roles first, topped up with common early-career roles so the feed is never narrow.
    return rl.dedupe(roles + DEFAULT_QUERIES, settings.job_ingest_max_queries)


async def _structure(listings: list[dict[str, Any]]) -> list[_Listing]:
    compact = [
        {"index": i, "source": raw.get("source"), "title": raw.get("title"), "company": raw.get("company"),
         "location": raw.get("location"), "experience": raw.get("experience", ""), "salary": raw.get("salary", ""),
         "description": _plain(raw.get("description") or "")[:6000]}
        for i, raw in enumerate(listings)
    ]
    prompt = _PROMPT.format(families=", ".join(ROLE_FAMILIES), listings=json.dumps(compact, ensure_ascii=False))
    result = await generate_structured(contents=prompt, schema=_Batch, lite=True, temperature=0.1)
    return result.jobs


def _to_doc(raw: dict[str, Any], item: _Listing, external_id: str) -> dict[str, Any]:
    now = utcnow()
    work_type = "onsite" if item.workType == "unknown" else item.workType
    city = "Remote" if work_type == "remote" else (item.city.strip() or (raw.get("location") or "").split(",")[0].strip() or "India")
    label = {"remote": "Remote", "hybrid": "Hybrid", "onsite": "On-site"}[work_type]
    level = "mid" if item.level == "senior" else item.level
    return {
        "_id": f"job_{external_id[:16]}",
        "externalId": external_id,
        "title": item.title.strip() or raw.get("title", ""),
        "company": item.company.strip() or raw.get("company", "") or "Company not disclosed",
        "location": f"{city} · {label}" if city != "Remote" else "Remote · India",
        "city": city,
        "workType": work_type,
        "level": level,
        "roleType": item.roleType if item.roleType in ROLE_FAMILIES else "Other",
        "experience": item.experience.strip(),
        "skills": rl.dedupe(item.skills, 8),
        "salary": item.salary.strip() or None,
        "applyUrl": raw.get("url") or None,
        "detail": {
            "jobType": item.jobType.strip() or "Full-time",
            "about": item.about.strip(),
            "responsibilities": rl.dedupe(item.responsibilities, 8),
            "requirements": rl.dedupe(item.requirements, 8),
            "niceToHave": rl.dedupe(item.niceToHave, 6),
            "stretchSkill": item.stretchSkill.strip(),
        },
        "source": f"apify:{raw.get('source', 'web')}",
        "active": True,
        "postedAt": _posted_at(raw.get("posted", "")),
        "ingestedAt": now,
        "lastSeenAt": now,
    }


async def _notify_matches(new_jobs: list[dict[str, Any]]) -> int:
    threshold = get_settings().job_match_notify_threshold
    notified = 0
    async for profile in mongo.profiles().find({}, {"data": 1}):
        matches = [job for job in new_jobs if match_percent(job, profile.get("data")) >= threshold]
        if matches:
            count = len(matches)
            await notify(
                profile["_id"],
                "jobs",
                f"{count} new job{'s' if count != 1 else ''} match your profile",
                ", ".join(f"{j['title']} at {j['company']}" for j in matches[:3]),
                "/jobs?view=matched",
            )
            notified += 1
    return notified


async def ingest() -> dict[str, Any]:
    """One ingestion pass. Returns a summary that is also stored in `ingest_runs`."""
    settings = get_settings()
    summary: dict[str, Any] = {"startedAt": utcnow(), "queries": [], "fetched": 0, "created": 0, "refreshed": 0, "skipped": 0, "errors": []}
    if not settings.apify_api_token:
        summary["errors"].append("APIFY_API_TOKEN is not set")
        return summary
    if not is_configured():
        summary["errors"].append("AI model is not configured")
        return summary
    if not await _acquire_lease():
        summary["errors"].append("another ingestion is running")
        return summary

    new_docs: list[dict[str, Any]] = []
    try:
        sources = [s.strip() for s in settings.job_ingest_sources.split(",") if s.strip()]
        summary["queries"] = await pick_queries()
        for query in summary["queries"]:
            try:
                result = await search_jobs_parallel(query=query, location=settings.job_ingest_location, limit=settings.job_ingest_per_query, sources=sources)
            except RuntimeError as exc:
                summary["errors"].append(f"{query}: {exc}")
                continue
            summary["errors"] += [f"{query}/{e['source']}: {e['error'][:200]}" for e in result.get("source_errors", [])]
            listings = result.get("jobs", [])
            summary["fetched"] += len(listings)

            fresh: list[tuple[dict[str, Any], str]] = []
            for raw in listings:
                ext = _external_id(raw.get("url", ""), raw.get("source", ""), raw.get("title", ""), raw.get("company", ""))
                seen = await mongo.jobs().update_one({"externalId": ext}, {"$set": {"lastSeenAt": utcnow(), "active": True}})
                if seen.matched_count:
                    summary["refreshed"] += 1
                else:
                    fresh.append((raw, ext))

            for start in range(0, len(fresh), _BATCH):
                batch = fresh[start : start + _BATCH]
                try:
                    items = await _structure([raw for raw, _ in batch])
                except (AIUnavailableError, AIResponseError) as exc:
                    summary["errors"].append(f"{query}: AI structuring failed ({exc})")
                    continue
                for item in items:
                    if not (0 <= item.index < len(batch)) or not item.isJobPosting or not item.title.strip():
                        summary["skipped"] += 1
                        continue
                    raw, ext = batch[item.index]
                    doc = _to_doc(raw, item, ext)
                    try:
                        await mongo.jobs().insert_one(doc)
                    except DuplicateKeyError:
                        summary["refreshed"] += 1
                        continue
                    new_docs.append(doc)
                    summary["created"] += 1

        cutoff = utcnow() - timedelta(days=settings.job_max_age_days)
        expired = await mongo.jobs().update_many({"source": {"$regex": "^apify:"}, "lastSeenAt": {"$lt": cutoff}, "active": True}, {"$set": {"active": False}})
        summary["expired"] = expired.modified_count
        if await mongo.jobs().count_documents({"active": True, "source": {"$ne": "seed"}}):
            demo = await mongo.jobs().update_many({"source": "seed", "active": True}, {"$set": {"active": False}})
            summary["demoJobsRetired"] = demo.modified_count
        summary["usersNotified"] = await _notify_matches(new_docs) if new_docs else 0
    finally:
        await _release_lease()
        summary["finishedAt"] = utcnow()
        await mongo.ingest_runs().insert_one({k: v for k, v in summary.items()})
        logger.info("Job ingestion: %s", {k: v for k, v in summary.items() if k not in {"startedAt", "finishedAt"}})
    return summary
