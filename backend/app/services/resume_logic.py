"""Deterministic resume helpers: Career Profile -> resume content, keyword coverage, and tailoring patches.

Ports src/utils/resumeFromProfile.ts so AI-generated resumes start from exactly the same data the
manual flows use, and so employers, titles and dates always come from the profile, never from the model.
"""

import re
from typing import Any

from app.core.utils import new_id

TOOLS = {
    "git", "github", "figma", "jira", "docker", "postman", "vs code", "notion", "slack", "excel", "power bi",
    "tableau", "firebase", "figjam", "maze", "miro", "framer",
}
EARLY_STAGE = {"student", "fresher"}
_PERIOD_SPLIT = re.compile(r"\s*[–—-]\s*")


def default_section_order(profile: dict[str, Any] | None) -> list[str]:
    if profile and profile.get("experienceLevel") in EARLY_STAGE:
        return ["education", "projects", "experience", "skills", "certifications"]
    return ["experience", "projects", "education", "skills", "certifications"]


def split_period(period: str) -> tuple[str, str]:
    parts = _PERIOD_SPLIT.split(period or "", maxsplit=1)
    start = parts[0].strip() if parts else ""
    end = parts[1].strip() if len(parts) > 1 else ""
    return start, end


def _find_link(profile: dict[str, Any], *needles: str) -> str:
    for link in profile.get("links") or []:
        haystack = f"{link.get('label', '')} {link.get('url', '')}".lower()
        if any(needle in haystack for needle in needles):
            return link.get("url", "")
    return ""


def _lines(text: str) -> list[str]:
    return [line.strip() for line in (text or "").split("\n") if line.strip()]


def is_tool(skill: str) -> bool:
    return skill.lower() in TOOLS


def empty_content(name: str = "", email: str = "") -> dict[str, Any]:
    return {
        "contact": {"name": name, "email": email, "phone": "", "location": "", "linkedin": "", "github": "", "portfolio": ""},
        "summary": "",
        "experience": [],
        "education": [],
        "projects": [],
        "skills": {"technical": [], "tools": [], "other": []},
        "certifications": [],
    }


def content_from_profile(profile: dict[str, Any], fallback_name: str = "", fallback_email: str = "") -> dict[str, Any]:
    """Copies the Career Profile into resume content (same mapping as buildContentFromProfile)."""
    experience = []
    for entry in profile.get("experience") or []:
        start, end = split_period(entry.get("period", ""))
        experience.append({
            "id": new_id(),
            "sourceId": entry.get("id", ""),
            "title": entry.get("role", ""),
            "company": entry.get("company", ""),
            "location": entry.get("location", ""),
            "start": start,
            "end": end,
            "description": "",
            "bullets": _lines(entry.get("summary", "")),
        })

    projects = []
    for project in profile.get("projects") or []:
        lines = _lines(project.get("description", ""))
        projects.append({
            "id": new_id(),
            "sourceId": project.get("id", ""),
            "name": project.get("name", ""),
            "description": lines[0] if lines else "",
            "tech": list(project.get("technologies") or []),
            "link": project.get("link", ""),
            "bullets": lines[1:],
        })

    skills = list(profile.get("skills") or [])
    return {
        "contact": {
            "name": profile.get("name") or fallback_name,
            "email": profile.get("email") or fallback_email,
            "phone": profile.get("phone", ""),
            "location": profile.get("location", ""),
            "linkedin": _find_link(profile, "linkedin"),
            "github": _find_link(profile, "github"),
            "portfolio": _find_link(profile, "portfolio", "website"),
        },
        "summary": profile.get("summary", ""),
        "experience": experience,
        "education": [
            {
                "id": new_id(),
                "degree": entry.get("degree", ""),
                "institution": entry.get("institution", ""),
                "location": "",
                "dates": entry.get("period", ""),
                "details": entry.get("details", ""),
            }
            for entry in profile.get("education") or []
        ],
        "projects": projects,
        "skills": {
            "technical": [s for s in skills if not is_tool(s)],
            "tools": [s for s in skills if is_tool(s)],
            "other": [],
        },
        "certifications": [
            {"id": new_id(), "name": c.get("name", ""), "issuer": c.get("issuer", ""), "date": c.get("year", ""), "link": ""}
            for c in profile.get("certifications") or []
        ],
    }


def strip_source_ids(content: dict[str, Any]) -> dict[str, Any]:
    for key in ("experience", "projects"):
        for item in content.get(key) or []:
            item.pop("sourceId", None)
    return content


def corpus(doc: dict[str, Any]) -> str:
    """Same text the frontend's docCorpus() searches."""
    content = doc.get("content") or {}
    skills = content.get("skills") or {}
    parts = [doc.get("targetRole", ""), content.get("summary", ""), *skills.get("technical", []), *skills.get("tools", []), *skills.get("other", [])]
    for e in content.get("experience") or []:
        parts += [e.get("title", ""), e.get("description", ""), *e.get("bullets", [])]
    for p in content.get("projects") or []:
        parts += [p.get("name", ""), p.get("description", ""), *p.get("tech", []), *p.get("bullets", [])]
    return " ".join(parts).lower()


def dedupe(values: list[str], limit: int | None = None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        cleaned = " ".join(str(value).split())
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            out.append(cleaned)
    return out[:limit] if limit else out


def split_keywords(keywords: list[str], text: str) -> tuple[list[str], list[str]]:
    lowered = text.lower()
    matched = [k for k in keywords if k.lower() in lowered]
    missing = [k for k in keywords if k.lower() not in lowered]
    return matched, missing


def apply_patch(doc: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Server-side twin of the frontend's patch application (src/services/tailor.service.ts)."""
    content = doc["content"]
    op = patch.get("op")
    if op == "setTargetRole":
        doc["targetRole"] = patch["value"]
    elif op == "setSummary":
        content["summary"] = patch["value"]
    elif op == "addSkills":
        category = patch.get("category", "other")
        existing = {s.lower() for group in content["skills"].values() for s in group}
        content["skills"][category] = [*content["skills"][category], *[s for s in patch["values"] if s.lower() not in existing]]
    elif op == "moveProjectToTop":
        projects = content["projects"]
        index = next((i for i, p in enumerate(projects) if p.get("id") == patch["projectId"]), -1)
        if index > 0:
            projects.insert(0, projects.pop(index))
    elif op == "replaceBullet":
        for entry in content["experience"]:
            if entry.get("id") == patch["experienceId"] and 0 <= patch["index"] < len(entry["bullets"]):
                entry["bullets"][patch["index"]] = patch["value"]
    return doc
