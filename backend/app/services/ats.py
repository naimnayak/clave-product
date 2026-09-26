"""Heuristic ATS estimate, a line-by-line port of src/utils/ats.ts so list scores match the editor popover."""

import math
import re
from typing import Any

_WORD_SPLIT = re.compile(r"\W+", re.ASCII)


def _round(n: float) -> int:
    # JavaScript Math.round semantics (half up), not Python's banker's rounding.
    return math.floor(n + 0.5)


def _clamp(n: float) -> int:
    return max(0, min(100, _round(n)))


def _words(text: str) -> int:
    return len(text.split())


def compute_ats(doc: dict[str, Any]) -> dict[str, Any]:
    content = doc.get("content") or {}
    contact = content.get("contact") or {}
    summary: str = content.get("summary") or ""
    experience: list[dict] = content.get("experience") or []
    education: list[dict] = content.get("education") or []
    projects: list[dict] = content.get("projects") or []
    skills = content.get("skills") or {}

    skill_count = len(skills.get("technical") or []) + len(skills.get("tools") or []) + len(skills.get("other") or [])
    bullets = [b for b in [*(b for e in experience for b in e.get("bullets") or []), *(b for p in projects for b in p.get("bullets") or [])] if b.strip()]

    checks = [
        (bool((contact.get("name") or "").strip()), "Add your name"),
        (bool((contact.get("email") or "").strip()), "Add an email address"),
        (bool((contact.get("phone") or "").strip()), "Add a phone number"),
        (bool(summary.strip()), "Add a professional summary"),
        (len(experience) + len(projects) > 0, "Add experience or projects"),
        (len(education) > 0, "Add your education"),
        (skill_count > 0, "Add your skills"),
    ]
    missing = next((note for passed, note in checks if not passed), None)
    completeness = _clamp(sum(1 for passed, _ in checks if passed) / len(checks) * 100)

    role_words = [w for w in _WORD_SPLIT.split((doc.get("targetRole") or "").lower()) if len(w) > 2]
    corpus = " ".join(
        [summary, *bullets, *(e.get("description") or "" for e in experience), *(p.get("description") or "" for p in projects)]
    ).lower()
    matched = sum(1 for word in role_words if word in corpus)
    keywords = _clamp(40 + min(skill_count, 10) * 4 + ((matched / len(role_words)) * 20 if role_words else 10))

    formatting = 96
    if not (contact.get("email") or "").strip():
        formatting -= 6
    if not (contact.get("phone") or "").strip():
        formatting -= 6
    if any(not (e.get("start") or "").strip() for e in experience):
        formatting -= 4

    long_bullets = sum(1 for b in bullets if _words(b) > 28)
    placeholders = sum(1 for b in bullets if "[" in b)
    summary_words = _words(summary)
    summary_off = summary_words > 0 and (summary_words < 20 or summary_words > 90)
    readability = _clamp(92 - long_bullets * 6 - placeholders * 4 - (10 if summary_off else 0) - (12 if not bullets else 0))

    if placeholders > 0:
        readability_note = "Replace [placeholders] with real numbers."
    elif long_bullets > 0:
        readability_note = "Shorten bullets over ~28 words."
    elif summary_off:
        readability_note = "Aim for a 2–4 sentence summary."
    else:
        readability_note = "Clear, concise wording."

    factors = [
        {
            "id": "keywords",
            "label": "Keyword relevance",
            "score": keywords,
            "note": "Add more skills that match your target role." if skill_count < 8 else "Good coverage of role-relevant skills.",
        },
        {
            "id": "completeness",
            "label": "Section completeness",
            "score": completeness,
            "note": f"{missing}." if missing else "All key sections are filled in.",
        },
        {"id": "formatting", "label": "Formatting", "score": _clamp(formatting), "note": "Single column with standard headings that ATS can read."},
        {"id": "readability", "label": "Readability", "score": readability, "note": readability_note},
    ]
    total = _clamp(keywords * 0.25 + completeness * 0.35 + formatting * 0.2 + readability * 0.2)
    return {"total": total, "factors": factors}
