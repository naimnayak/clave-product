"""Job catalog helpers: per-user match score and the Job/JobDetail shapes from src/types/job.ts.

The match uses what we know about the user (`Signals`):
- skills from their latest resume, plus Career Profile skills and project technologies,
- role words from the resume's target role and job titles, plus the profile's target roles,
- keywords and titles of the job descriptions they submitted, newest weighted highest.

With JDs:    45% skills, 25% JD similarity, 15% role, 8% level, 7% work mode.
Without JDs: 60% skills, 22% role, 10% level, 8% work mode.
There is no base score: a user we know nothing about scores 0 everywhere.
"""

import math
import re
from dataclasses import dataclass, field
from typing import Any

from app.core.utils import drop_none, utcnow
from app.db import mongo
from app.services import job_descriptions

_LEVEL_FIT = {
    "student": {"internship", "entry"},
    "fresher": {"internship", "entry", "junior"},
    "early": {"entry", "junior", "mid"},
    "experienced": {"junior", "mid"},
}
_GENERIC_ROLE_WORDS = {"senior", "junior", "intern", "internship", "associate", "lead", "the", "and", "for", "with", "trainee", "fresher"}
RECOMMENDED_COUNT = 6
RECOMMEND_MIN = 55  # "recommended" means a real fit, not just the best of a weak list
_JD_WEIGHTS = (1.0, 0.8, 0.65, 0.5, 0.4)  # newest JD first


@dataclass
class JdSignal:
    keywords: set[str]
    title_words: set[str]
    weight: float


@dataclass
class Signals:
    skills: set[str] = field(default_factory=set)
    roles: set[str] = field(default_factory=set)
    level: str | None = None
    work_modes: list[str] = field(default_factory=list)
    jds: list[JdSignal] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not (self.skills or self.roles or self.jds)


def _clean(values: Any) -> set[str]:
    return {str(v).lower().strip() for v in values or [] if str(v).strip()}


def _role_words(*titles: str) -> set[str]:
    words: set[str] = set()
    for title in titles:
        for word in re.split(r"[\s/,()\-|·]+", (title or "").lower()):
            if len(word) > 2 and word not in _GENERIC_ROLE_WORDS:
                words.add(word)
    return words


def build_signals(profile: dict[str, Any] | None, resume: dict[str, Any] | None = None, jds: list[dict[str, Any]] | None = None) -> Signals:
    profile = profile or {}
    signals = Signals(level=profile.get("experienceLevel"), work_modes=list(profile.get("workModes") or []))
    signals.skills |= _clean(profile.get("skills"))
    for project in profile.get("projects") or []:
        signals.skills |= _clean(project.get("technologies"))
    signals.roles |= _role_words(*(profile.get("targetRoles") or []))

    if resume:
        content = resume.get("content") or {}
        skills = content.get("skills") or {}
        signals.skills |= _clean([*skills.get("technical", []), *skills.get("tools", []), *skills.get("other", [])])
        for project in content.get("projects") or []:
            signals.skills |= _clean(project.get("tech"))
        signals.roles |= _role_words(resume.get("targetRole", ""), *(e.get("title", "") for e in content.get("experience") or []))

    for jd, weight in zip(jds or [], _JD_WEIGHTS):
        keywords = _clean(jd.get("keywords"))
        if keywords:
            signals.jds.append(JdSignal(keywords, _role_words(jd.get("title", "")), weight))
    return signals


async def load_signals(uid: str) -> Signals:
    profile_doc = await mongo.profiles().find_one({"_id": uid})
    resume = await mongo.resumes().find_one({"uid": uid}, sort=[("updatedAt", -1)])
    jds = await job_descriptions.recent(uid)
    return build_signals((profile_doc or {}).get("data"), resume, jds)


def _has_skill(skill: str, terms: set[str]) -> bool:
    s = skill.lower().strip()
    return s in terms or any(len(t) > 2 and (t in s or s in t) for t in terms)


def match(job: dict[str, Any], signals: Signals | None) -> tuple[int, list[str], list[str]]:
    """Returns (0-99 match percent, job skills the user has, job skills they don't)."""
    skills = job.get("skills") or []
    if signals is None or signals.empty:
        return 0, [], list(skills)
    matched = [s for s in skills if _has_skill(s, signals.skills)]
    missing = [s for s in skills if s not in matched]
    skill_fit = len(matched) / len(skills) if skills else 0.0

    haystack = f"{job.get('title', '')} {job.get('roleType', '')}".lower()
    title_words = _role_words(job.get("title", ""), job.get("roleType", ""))
    role_hit = any(w in haystack for w in signals.roles)
    level_hit = signals.level in _LEVEL_FIT and job.get("level") in _LEVEL_FIT[signals.level]
    mode_fit = (1.0 if job.get("workType") in signals.work_modes else 0.0) if signals.work_modes else 0.5

    jd_fit = 0.0
    for jd in signals.jds:
        skill_overlap = sum(1 for s in skills if _has_skill(s, jd.keywords)) / len(skills) if skills else 0.0
        title_overlap = len(title_words & jd.title_words) / len(jd.title_words) if jd.title_words else 0.0
        jd_fit = max(jd_fit, jd.weight * (0.7 * skill_overlap + 0.3 * title_overlap))
    if not (matched or role_hit or jd_fit):
        return 0, [], missing  # level and work mode alone don't make a job relevant
    if signals.jds:
        score = 45 * skill_fit + 25 * jd_fit + 15 * role_hit + 8 * level_hit + 7 * mode_fit
    else:
        score = 60 * skill_fit + 22 * role_hit + 10 * level_hit + 8 * mode_fit
    return max(0, min(99, math.floor(score + 0.5))), matched, missing


def match_percent(job: dict[str, Any], signals: Signals | None) -> int:
    return match(job, signals)[0]


def to_job(doc: dict[str, Any], signals: Signals | None) -> dict[str, Any]:
    posted = doc.get("postedAt")
    days = max(0, (utcnow() - posted).days) if posted else 0
    percent, matched, missing = match(doc, signals)
    return drop_none({
        "id": doc["_id"],
        "title": doc.get("title", ""),
        "company": doc.get("company", ""),
        "location": doc.get("location", ""),
        "experience": doc.get("experience", ""),
        "matchPercent": percent,
        "matchedSkills": matched,
        "missingSkills": missing,
        "skills": doc.get("skills") or [],
        "city": doc.get("city", ""),
        "workType": doc.get("workType", "onsite"),
        "level": doc.get("level", "entry"),
        "roleType": doc.get("roleType", ""),
        "postedDaysAgo": days,
        "salary": doc.get("salary") or None,
        "applyUrl": doc.get("applyUrl") or None,
        "source": (doc.get("source") or "").removeprefix("apify:") or None,
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
    """Marks the best real fits as recommended (the Jobs page 'Recommended for You' view)."""
    ranked = sorted((j for j in jobs if j["matchPercent"] >= RECOMMEND_MIN), key=lambda j: (-j["matchPercent"], j["postedDaysAgo"]))
    top = {j["id"] for j in ranked[:RECOMMENDED_COUNT]}
    return [{**j, "recommended": j["id"] in top} for j in jobs]
