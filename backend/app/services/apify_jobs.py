"""Live job search across Indeed, Naukri, LinkedIn, Internshala and Foundit through Apify actors.

Results are raw listings (title, company, location, url, description); services/job_ingest.py turns
them into structured catalog jobs. Every actor call is counted in `job_feed_usage` (`apify:YYYY-MM`)
and searches stop once APIFY_MONTHLY_RESULT_LIMIT listings have been fetched in the month.
"""

import asyncio
import logging
import math
import re
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

import httpx

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo

logger = logging.getLogger(__name__)

APIFY_BASE_URL = "https://api.apify.com/v2"
DEFAULT_TIMEOUT = 75
SUPPORTED_SOURCES = ("indeed", "naukri", "linkedin", "internshala", "foundit")


class ApifyBudgetExceeded(RuntimeError):
    """The month's listing budget is used up; searches resume next month."""


def _actor_map() -> Dict[str, str]:
    """Actor IDs from settings (APIFY_ACTOR_* in backend/.env)."""
    s = get_settings()
    return {
        "indeed": s.apify_actor_indeed,
        "naukri": s.apify_actor_naukri,
        "linkedin": s.apify_actor_linkedin,
        "internshala": s.apify_actor_internshala,
        "foundit": s.apify_actor_foundit,
    }


def _usage_key() -> str:
    return f"apify:{utcnow().strftime('%Y-%m')}"


async def monthly_results_used() -> int:
    doc = await mongo.job_feed_usage().find_one({"_id": _usage_key()})
    return int((doc or {}).get("results", 0))


async def _record_results(count: int) -> None:
    if count <= 0:
        return
    doc = await mongo.job_feed_usage().find_one_and_update(
        {"_id": _usage_key()}, {"$inc": {"results": count, "runs": 1}}, upsert=True, return_document=True
    )
    settings = get_settings()
    used = int((doc or {}).get("results", count))
    cap = settings.apify_monthly_result_limit
    if cap and used >= cap * 0.8 and used - count < cap * 0.8:
        logger.warning("Apify usage at %d of %d listings this month (~$%.2f).", used, cap, used * settings.apify_cost_per_1000_usd / 1000)


async def _check_budget() -> None:
    cap = get_settings().apify_monthly_result_limit
    if cap and await monthly_results_used() >= cap:
        raise ApifyBudgetExceeded("Monthly Apify listing budget reached")

STOPWORDS = {
    "and", "the", "for", "with", "your", "you", "our", "are", "this", "that", "from", "into",
    "role", "overview", "responsibilities", "required", "skills", "expertise", "qualifications",
    "preferred", "what", "looking", "seeking", "experience", "years", "year", "digital",
}

NEGATIVE_PAGE_HINTS = {
    "resume", "cv", "template", "templates", "sample", "samples", "how to", "guide", "tips",
    "career advice", "interview questions", "cover letter", "fresher resume", "internship resume",
    "job vacancies in",
}

NEGATIVE_URL_HINTS = {
    "career-advice", "resume-sample", "resume", "cv", "interview-questions", "salary-guide",
}


def _keyword_tokens(text: str) -> List[str]:
    words = re.findall(r"[a-zA-Z]{3,}", (text or "").lower())
    return [w for w in words if w not in STOPWORDS]


def _extract_location_from_title(title: str) -> str:
    # Common scraped format: "Role - City - Company"
    parts = [p.strip() for p in (title or "").split("-") if p.strip()]
    if len(parts) >= 2:
        candidate = parts[1]
        bad_location_tokens = {
            "seo", "social media", "content", "campaign", "amazon", "ppc", "performance",
            "marketing", "specialist", "manager", "executive",
        }
        lowered = candidate.lower()
        if not any(tok in lowered for tok in bad_location_tokens):
            return candidate

    # Indeed-style format: "Role jobs in City, ST"
    m = re.search(r"\bjobs in\s+(.+)$", title or "", flags=re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return ""


def _extract_location_from_url(url: str) -> str:
    u = (url or "").lower()
    m = re.search(r"-l-([a-z0-9\-,]+)-jobs", u)
    if not m:
        return ""
    token = m.group(1).replace("-", " ").strip(" ,")
    return token.title()


def _looks_like_non_job(job: Dict[str, str]) -> bool:
    title = (job.get("title") or "").lower()
    url = (job.get("url") or "").lower()
    desc = (job.get("description") or "").lower()
    haystack = f"{title} {desc}"

    if any(h in haystack for h in NEGATIVE_PAGE_HINTS):
        return True
    if any(h in url for h in NEGATIVE_URL_HINTS):
        return True

    # Drop generic listing/search directory URLs and keep concrete posting pages.
    if "naukri.com" in url:
        if "job-listings-" not in url and "-jobs-in-" in url:
            return True

    if re.search(r"\b\d+\s+.*job vacancies in\b", title):
        return True

    if "indeed.com" in url:
        # Keep concrete posting pages, drop generic search/listing pages.
        if "/q-" in url and "/viewjob" not in url and "/rc/clk" not in url:
            return True
        if "jobs, employment" in title:
            return True

    if title.endswith(" jobs") and " - " not in title and "jobs in" not in title:
        return True

    return False


def _is_relevant_to_query(job: Dict[str, str], query: str) -> bool:
    query_tokens = set(_keyword_tokens(query))
    if not query_tokens:
        return True

    title_desc = f"{job.get('title', '')} {job.get('description', '')}".lower()
    matches = sum(1 for t in query_tokens if t in title_desc)
    return matches >= 1


def _clean_jobs_for_output(jobs: List[Dict[str, str]], query: str) -> List[Dict[str, str]]:
    cleaned: List[Dict[str, str]] = []

    for job in jobs:
        if _looks_like_non_job(job):
            continue
        if not _is_relevant_to_query(job, query):
            continue

        if not (job.get("location") or "").strip():
            inferred_loc = _extract_location_from_title(job.get("title", ""))
            if not inferred_loc:
                inferred_loc = _extract_location_from_url(job.get("url", ""))
            if inferred_loc:
                job["location"] = inferred_loc

        cleaned.append(job)

    return cleaned


def _resolve_apify_token() -> str:
    """Accept raw token or full Apify API URL containing token query param."""
    raw = (get_settings().apify_api_token or "").strip()
    if not raw:
        return ""

    if raw.startswith("http://") or raw.startswith("https://"):
        parsed = urlparse(raw)
        token = parse_qs(parsed.query).get("token", [""])[0].strip()
        return token

    return raw


def _to_actor_id_for_path(actor_id: str) -> str:
    """Normalize actor id for Apify URL path.

    Apify accepts actor IDs like "username~actor-name" in path params.
    Our env defaults may be "username/actor-name".
    """
    value = (actor_id or "").strip()
    if "/" in value:
        return value.replace("/", "~", 1)
    return value


def _build_source_inputs(query: str, location: str, limit: int) -> Dict[str, List[Dict[str, Any]]]:
    search_text = f"{query} {location}".strip()
    query_tokens = re.findall(r"[a-zA-Z0-9]+", query.lower())[:8]
    query_slug = "-".join(query_tokens) if query_tokens else "jobs"
    location_tokens = re.findall(r"[a-zA-Z0-9]+", location.lower())
    location_slug = "-".join(location_tokens)
    naukri_url = (
        f"https://www.naukri.com/{query_slug}-jobs-in-{location_slug}"
        if location_slug
        else f"https://www.naukri.com/{query_slug}-jobs"
    )

    return {
        "indeed": [
            # misceres/indeed-scraper input (the ATS backend's pro100chok actor was removed from Apify)
            {
                "position": query,
                "location": location,
                "country": "IN",
                "maxItemsPerSearch": limit,
                "saveOnlyUniqueItems": True,
            },
            {
                "searchQueries": [search_text],
                "maxItems": limit,
                "parseCompanyDetails": False,
            },
            {
                "query": search_text,
                "limit": limit,
            },
        ],
        "naukri": [
            # memo23/naukri-scraper input
            {
                "platform": "naukri",
                "searchQuery": query,
                "location": location or "india",
                "maximumJobs": limit,
                "sortBy": "date",
            },
            {
                "startUrls": [{"url": naukri_url}],
                "maxItems": limit,
            },
            {
                "startUrls": [naukri_url],
                "maxItems": limit,
            },
            {
                "keyword": query,
                "location": location,
                "maxItems": limit,
            },
        ],
        "linkedin": [
            {
                "title": query,
                "location": location,
                "rows": limit,
            },
            {
                "searchTerms": [search_text],
                "limit": limit,
            },
        ],
        "internshala": [
            # crawloop/internshala-scraper: internships plus jobs, the campus / fresher board
            {
                "position": query,
                "location": "" if location.lower() == "india" else location,
                "listingType": "internships_and_jobs",
                "maxItems": limit,
                "maxPages": 1,
            },
        ],
        "foundit": [
            # crawloop/foundit-jobs-scraper (same input grammar as the crawloop Internshala actor)
            {
                "position": query,
                "location": location,
                "maxItems": limit,
                "maxPages": 1,
            },
            {
                "keyword": query,
                "location": location,
                "maxItems": limit,
            },
        ],
    }


def _build_google_fallback_inputs(query: str, location: str, source: str, limit: int) -> List[Dict[str, Any]]:
    domain_map = {
        "indeed": "indeed.com",
        "naukri": "naukri.com",
        "linkedin": "linkedin.com/jobs",
    }
    domain = domain_map.get(source, "")
    q = f"site:{domain} {query} {location} jobs".strip()

    return [
        {
            "queries": q,
            "maxPagesPerQuery": 1,
            "resultsPerPage": max(5, min(limit, 20)),
            "languageCode": "en",
        },
        {
            "queries": q,
            "maxPagesPerQuery": 1,
            "maxResults": max(5, min(limit, 20)),
        },
    ]


def _pick_first(item: Dict[str, Any], keys: List[str], default: str = "") -> str:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return default


def _to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, dict):
        for k in ["name", "title", "value", "text", "label", "city", "location"]:
            v = value.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return ""
    if isinstance(value, list):
        parts = [_to_text(v) for v in value]
        parts = [p for p in parts if p]
        return ", ".join(parts)
    return ""


def _pick_first_flexible(item: Dict[str, Any], keys: List[str], default: str = "") -> str:
    for key in keys:
        if key not in item:
            continue
        text = _to_text(item.get(key))
        if text:
            return text
    return default


def _as_mapping(value: Any) -> Any:
    """Some actors return nested objects as Python-repr strings ("{'name': ...}")."""
    if isinstance(value, str) and value.startswith(("{", "[")):
        import ast

        try:
            return ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return value
    return value


def _normalize_job(item: Dict[str, Any], source: str) -> Dict[str, str]:
    item = {key: _as_mapping(value) for key, value in item.items()}
    salary = item.get("salaryDetail")
    salary_text = salary.get("label", "") if isinstance(salary, dict) else ""
    if salary_text.lower() == "not disclosed":
        salary_text = ""
    return {
        "source": source,
        "title": _pick_first_flexible(item, ["title", "positionName", "jobTitle", "position", "job_title"]),
        "company": _pick_first_flexible(item, ["company", "companyName", "companyDetail", "employer", "employerName", "company_name", "companyInfo"]),
        "location": _pick_first_flexible(item, ["location", "jobLocation", "locations", "city", "place"]),
        "url": _pick_first_flexible(item, ["url", "jobUrl", "link", "applyUrl", "job_link", "jobLink", "staticUrl"]),
        "description": _pick_first_flexible(item, ["description", "descriptionHTML", "snippet", "shortDescription", "summary", "jobDescription", "details"]),
        "experience": _pick_first_flexible(item, ["experienceText", "experience", "jobExperience"]),
        "salary": salary_text or _pick_first_flexible(item, ["salary", "salaryText", "compensationText"]),
        "posted": _pick_first_flexible(item, ["postingDateParsed", "createdDate", "postedAt", "datePosted", "postedText"]),
        "skills": _pick_first_flexible(item, ["skills", "keySkills", "tagsAndSkills"]),
    }


async def _run_actor(
    client: httpx.AsyncClient,
    token: str,
    actor_id: str,
    source: str,
    payload_candidates: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    last_error = ""
    path_actor_id = _to_actor_id_for_path(actor_id)

    for payload in payload_candidates:
        try:
            url = f"{APIFY_BASE_URL}/acts/{path_actor_id}/run-sync-get-dataset-items"
            response = await client.post(
                url,
                params={"token": token, "format": "json", "clean": "true"},
                json=payload,
            )
            if response.status_code >= 400:
                detail = response.text[:500]
                last_error = f"{source} actor returned {response.status_code}: {detail}"
                continue

            data = response.json()
            rows = data if isinstance(data, list) else data.get("items") if isinstance(data, dict) else None
            rows = rows if isinstance(rows, list) else []
            await _record_results(len(rows))  # pay-per-result actors bill every returned row
            return rows
        except Exception as e:
            last_error = f"{source} request failed: {str(e)}"

    raise RuntimeError(last_error or f"{source} failed")


def _is_naukri_header_error(error_text: str) -> bool:
    t = (error_text or "").lower()
    return "app id" in t and "systemid" in t


def _extract_from_google_search_items(items: List[Dict[str, Any]], source: str) -> List[Dict[str, Any]]:
    flattened: List[Dict[str, Any]] = []

    for item in items:
        if not isinstance(item, dict):
            continue

        organic = item.get("organicResults")
        if isinstance(organic, list):
            for row in organic:
                if not isinstance(row, dict):
                    continue
                flattened.append(
                    {
                        "title": row.get("title", ""),
                        "url": row.get("url", ""),
                        "description": row.get("description", ""),
                        "companyName": row.get("displayedUrl", ""),
                        "location": "",
                        "source": source,
                    }
                )
            continue

        flattened.append(item)

    return flattened


def _interleave_by_source(jobs: List[Dict[str, str]], active_sources: List[str], limit: int) -> List[Dict[str, str]]:
    buckets: Dict[str, List[Dict[str, str]]] = {s: [] for s in active_sources}
    for job in jobs:
        src = (job.get("source") or "").lower()
        if src in buckets:
            buckets[src].append(job)

    merged: List[Dict[str, str]] = []
    while len(merged) < limit:
        progressed = False
        for src in active_sources:
            if buckets[src]:
                merged.append(buckets[src].pop(0))
                progressed = True
                if len(merged) >= limit:
                    break
        if not progressed:
            break
    return merged


async def search_jobs_parallel(
    query: str,
    location: str,
    limit: int = 12,
    sources: Optional[List[str]] = None,
) -> Dict[str, Any]:
    token = _resolve_apify_token()
    if not token:
        raise RuntimeError("APIFY_API_TOKEN is missing")

    await _check_budget()
    limit = max(1, min(limit, 30))
    requested_sources = [s.lower() for s in (sources or ["indeed", "naukri"])]

    linkedin_enabled = get_settings().apify_linkedin_enabled

    active_sources: List[str] = []
    skipped_sources: List[Dict[str, str]] = []

    for source in requested_sources:
        if source == "linkedin" and not linkedin_enabled:
            skipped_sources.append({
                "source": "linkedin",
                "reason": "LinkedIn scraping is off (APIFY_LINKEDIN_ENABLED=false)",
            })
            continue
        if source in SUPPORTED_SOURCES and source not in active_sources:
            active_sources.append(source)

    actor_map = _actor_map()
    fallback_actor = get_settings().apify_actor_google_search
    # Each board only fetches its share of `limit` (+1 spare for filtering), so billed results stay
    # close to what is kept instead of limit x number of boards.
    per_source = min(limit, math.ceil(limit / max(1, len(active_sources))) + 1)
    input_map = _build_source_inputs(query=query, location=location, limit=per_source)

    jobs: List[Dict[str, str]] = []
    source_errors: List[Dict[str, str]] = []
    source_counts: Dict[str, int] = {s: 0 for s in active_sources}

    timeout = httpx.Timeout(DEFAULT_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        tasks = []
        task_sources = []
        for source in active_sources:
            tasks.append(
                _run_actor(
                    client=client,
                    token=token,
                    actor_id=actor_map[source],
                    source=source,
                    payload_candidates=input_map[source],
                )
            )
            task_sources.append(source)

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for source, result in zip(task_sources, results):
                if source == "naukri" and isinstance(result, Exception):
                    # Strict actor may require extra headers (AppId/SystemId).
                    # Fall back to alternate actor automatically.
                    if _is_naukri_header_error(str(result)):
                        try:
                            legacy_rows = await _run_actor(
                                client=client,
                                token=token,
                                actor_id=actor_map["naukri"],
                                source="naukri-strict",
                                payload_candidates=input_map["naukri"],
                            )
                            for item in legacy_rows:
                                if isinstance(item, dict):
                                    normalized = _normalize_job(item, "naukri")
                                    if normalized["title"]:
                                        jobs.append(normalized)
                                        source_counts["naukri"] = source_counts.get("naukri", 0) + 1
                            continue
                        except Exception as strict_error:
                            source_errors.append(
                                {
                                    "source": "naukri",
                                    "error": f"{str(result)} | strict fallback failed: {str(strict_error)}",
                                }
                            )
                            continue

                if isinstance(result, Exception):
                    # Fallback: use Apify Google Search actor when source actor is missing/unavailable.
                    fallback_items: List[Dict[str, Any]] = []
                    try:
                        fallback_items = await _run_actor(
                            client=client,
                            token=token,
                            actor_id=fallback_actor,
                            source=f"{source}-fallback",
                            payload_candidates=_build_google_fallback_inputs(
                                query=query,
                                location=location,
                                source=source,
                                limit=per_source,
                            ),
                        )
                    except Exception as fallback_error:
                        source_errors.append(
                            {
                                "source": source,
                                "error": f"{str(result)} | fallback failed: {str(fallback_error)}",
                            }
                        )
                        continue

                    extracted = _extract_from_google_search_items(fallback_items, source)
                    if not extracted:
                        source_errors.append({"source": source, "error": str(result)})
                        continue

                    for item in extracted:
                        if isinstance(item, dict):
                            normalized = _normalize_job(item, source)
                            if normalized["title"]:
                                jobs.append(normalized)
                                source_counts[source] = source_counts.get(source, 0) + 1
                    continue

                if not result:
                    # If a source returns no rows, try a broader Apify search fallback.
                    try:
                        fallback_items = await _run_actor(
                            client=client,
                            token=token,
                            actor_id=fallback_actor,
                            source=f"{source}-fallback",
                            payload_candidates=_build_google_fallback_inputs(
                                query=query,
                                location=location,
                                source=source,
                                limit=per_source,
                            ),
                        )
                        extracted = _extract_from_google_search_items(fallback_items, source)
                        for item in extracted:
                            if isinstance(item, dict):
                                normalized = _normalize_job(item, source)
                                if normalized["title"]:
                                    jobs.append(normalized)
                                    source_counts[source] = source_counts.get(source, 0) + 1
                        continue
                    except Exception:
                        source_errors.append({"source": source, "error": "No jobs returned for this query"})
                        continue

                for item in result:
                    if isinstance(item, dict):
                        normalized = _normalize_job(item, source)
                        if normalized["title"]:
                            jobs.append(normalized)
                            source_counts[source] = source_counts.get(source, 0) + 1

    deduped: List[Dict[str, str]] = []
    seen = set()
    for job in jobs:
        key = job["url"] or f"{job['source']}::{job['title']}::{job['company']}::{job['location']}"
        if key in seen:
            continue
        seen.add(key)
        deduped.append(job)

    deduped = _clean_jobs_for_output(deduped, query=query)
    deduped = _interleave_by_source(deduped, active_sources=active_sources, limit=limit)

    # Recompute source counts after dedupe/quality filtering for accurate UI status.
    source_counts = {s: 0 for s in active_sources}
    for job in deduped:
        src = (job.get("source") or "").lower()
        if src in source_counts:
            source_counts[src] += 1

    sources_no_results = [s for s, c in source_counts.items() if c == 0]

    return {
        "jobs": deduped[:limit],
        "count": min(len(deduped), limit),
        "sources_requested": requested_sources,
        "sources_used": active_sources,
        "sources_skipped": skipped_sources,
        "source_errors": source_errors,
        "source_counts": source_counts,
        "sources_no_results": sources_no_results,
    }
