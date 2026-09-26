"""Job catalog helpers: per-user match score and the Job/JobDetail shapes from src/types/job.ts."""

import math
from typing import Any

from app.core.utils import drop_none, utcnow

_LEVEL_FIT = {
    "student": {"internship", "entry"},
    "fresher": {"internship", "entry", "junior"},
    "early": {"entry", "junior", "mid"},
    "experienced": {"junior", "mid"},
}
_GENERIC_ROLE_WORDS = {"senior", "junior", "intern", "internship", "associate", "lead", "the", "and", "for"}
RECOMMENDED_COUNT = 6


def _profile_terms(profile: dict[str, Any] | None) -> set[str]:
    if not profile:
        return set()
    terms = {s.lower().strip() for s in profile.get("skills") or [] if s.strip()}
    for project in profile.get("projects") or []:
        terms |= {t.lower().strip() for t in project.get("technologies") or [] if t.strip()}
    return terms


def _has_skill(skill: str, terms: set[str]) -> bool:
    s = skill.lower()
    return s in terms or any(len(t) > 2 and (t in s or s in t) for t in terms)


def match_percent(job: dict[str, Any], profile: dict[str, Any] | None) -> int:
    """Heuristic 0-100 fit between a listing and the Career Profile (skills, target role, level, work mode)."""
    terms = _profile_terms(profile)
    skills = job.get("skills") or []
    skill_score = sum(1 for s in skills if _has_skill(s, terms)) / len(skills) if skills else 0.0

    role_words = {
        w
        for role in (profile or {}).get("targetRoles") or []
        for w in role.lower().replace("/", " ").split()
        if len(w) > 2 and w not in _GENERIC_ROLE_WORDS
    }
    haystack = f"{job.get('title', '')} {job.get('roleType', '')}".lower()
    role_hit = any(w in haystack for w in role_words)

    level = (profile or {}).get("experienceLevel")
    level_hit = level in _LEVEL_FIT and job.get("level") in _LEVEL_FIT[level]

    modes = (profile or {}).get("workModes") or []
    mode_score = (1.0 if job.get("workType") in modes else 0.0) if modes else 0.5

    score = 35 + 40 * skill_score + 12 * role_hit + 8 * level_hit + 5 * mode_score
    return max(30, min(98, math.floor(score + 0.5)))


def to_job(doc: dict[str, Any], profile: dict[str, Any] | None) -> dict[str, Any]:
    posted = doc.get("postedAt")
    days = max(0, (utcnow() - posted).days) if posted else 0
    return drop_none({
        "id": doc["_id"],
        "title": doc.get("title", ""),
        "company": doc.get("company", ""),
        "location": doc.get("location", ""),
        "experience": doc.get("experience", ""),
        "matchPercent": match_percent(doc, profile),
        "skills": doc.get("skills") or [],
        "city": doc.get("city", ""),
        "workType": doc.get("workType", "onsite"),
        "level": doc.get("level", "entry"),
        "roleType": doc.get("roleType", ""),
        "postedDaysAgo": days,
        "salary": doc.get("salary") or None,
        "applyUrl": doc.get("applyUrl") or None,
    })


def to_detail(doc: dict[str, Any]) -> dict[str, Any]:
    detail = doc.get("detail") or {}
    return {
        "jobType": detail.get("jobType", ""),
        "about": detail.get("about", ""),
        "responsibilities": detail.get("responsibilities") or [],
        "requirements": detail.get("requirements") or [],
        "niceToHave": detail.get("niceToHave") or [],
        "stretchSkill": detail.get("stretchSkill", ""),
    }


def with_recommendations(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Marks the best-matching listings as recommended (the Jobs page 'Recommended for You' view)."""
    ranked = sorted(jobs, key=lambda j: (-j["matchPercent"], j["postedDaysAgo"]))
    top = {j["id"] for j in ranked[:RECOMMENDED_COUNT]}
    return [{**j, "recommended": j["id"] in top} for j in jobs]
