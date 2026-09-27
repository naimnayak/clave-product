"""Jobs as a Pro feature: gating, the free preview, resume + JD matching, saved JDs and the personal feed."""

from datetime import timedelta

import pytest

from app.core.config import get_settings
from app.core.utils import utcnow
from app.db import mongo
from app.services import ai_tasks, apify_jobs, job_feed, job_ingest
from tests.helpers import error_code, resume_body, signed_up

JD_TEXT = (
    "We are hiring a Data Analyst to build dashboards in Power BI, write SQL queries and automate reports with Python. "
    "You will work with the finance team on forecasting."
)


async def _job(job_id: str, title: str, skills: list[str], **extra) -> None:
    await mongo.jobs().insert_one({
        "_id": job_id, "title": title, "company": f"{title} Co", "skills": skills, "level": "entry", "workType": "remote",
        "roleType": "Data & Analytics", "active": True, "source": "apify:indeed", "postedAt": utcnow(),
        "applyUrl": f"https://jobs.example/{job_id}", **extra,
    })


async def _make_pro(uid: str) -> None:
    await mongo.users().update_one(
        {"_id": uid}, {"$set": {"subscription.plan": "monthly", "subscription.currentPeriodEnd": utcnow() + timedelta(days=20)}}
    )


def _data_resume() -> dict:
    body = resume_body("Data CV")
    body["targetRole"] = "Data Analyst"
    body["content"]["skills"] = {"technical": ["SQL", "Python"], "tools": ["Excel"]}
    return body


@pytest.fixture
def fake_ats(monkeypatch):
    async def ats_analysis(doc, job_description):
        return {"score": 70, "summary": "ok", "factors": {}, "missingKeywords": [], "suggestions": [], "heuristic": {},
                "jobTitle": "Data Analyst", "company": "FinCo", "jobKeywords": ["Power BI", "SQL", "Python", "Forecasting"]}

    monkeypatch.setattr(ai_tasks, "ats_analysis", ats_analysis)


async def test_free_users_get_a_masked_preview(client):
    headers = await signed_up(client, "free-seeker")
    await client.post("/api/resumes", json=_data_resume(), headers=headers)
    await _job("job_sql", "Data Analyst", ["SQL", "Python", "Tableau"])
    await _job("job_design", "Brand Designer", ["Figma", "Illustrator"], roleType="Product Design")

    for path in ("/api/jobs", "/api/jobs/recommended", "/api/jobs/details", "/api/jobs/saved", "/api/jobs/job_sql", "/api/companies"):
        response = await client.get(path, headers=headers)
        assert response.status_code == 402 and error_code(response) == "PRO_REQUIRED", path
    assert (await client.post("/api/jobs/job_sql/save", headers=headers)).status_code == 402

    preview = (await client.get("/api/jobs/preview", headers=headers)).json()["data"]
    assert preview["isPro"] is False and preview["totalJobs"] == 2
    top = preview["jobs"][0]
    assert top["title"] == "Data Analyst" and top["locked"] is True
    assert top["company"] == "Hidden until you upgrade" and "applyUrl" not in top
    assert [j["title"] for j in preview["jobs"]] == ["Data Analyst"]  # zero-match jobs aren't teased


async def test_matching_uses_resume_and_latest_jd(client, fake_ats):
    headers = await signed_up(client, "matcher")
    await _make_pro("matcher")
    await _job("job_bi", "BI Analyst", ["Power BI", "Forecasting", "SQL"])
    await _job("job_web", "Web Developer", ["React", "Node.js", "CSS"])

    # Nothing known about the user yet: no fake base score.
    before = {j["id"]: j["matchPercent"] for j in (await client.get("/api/jobs", headers=headers)).json()["data"]}
    assert before == {"job_bi": 0, "job_web": 0}

    resume = (await client.post("/api/resumes", json=_data_resume(), headers=headers)).json()["data"]
    resume_only = {j["id"]: j["matchPercent"] for j in (await client.get("/api/jobs", headers=headers)).json()["data"]}
    assert resume_only["job_bi"] > resume_only["job_web"]

    # Submitting a JD saves it and pulls matching jobs further up.
    analyzed = await client.post(f"/api/resumes/{resume['id']}/analyze", json={"jobDescription": JD_TEXT}, headers=headers)
    assert analyzed.status_code == 200 and "jobKeywords" not in analyzed.json()["data"]
    saved = (await client.get("/api/job-descriptions", headers=headers)).json()["data"]
    assert len(saved) == 1 and saved[0]["title"] == "Data Analyst" and "Power BI" in saved[0]["keywords"]

    jobs = {j["id"]: j for j in (await client.get("/api/jobs", headers=headers)).json()["data"]}
    assert jobs["job_bi"]["matchPercent"] > resume_only["job_bi"]
    assert jobs["job_bi"]["matchedSkills"] == ["SQL"]  # from the resume; Power BI is a JD keyword, not a skill they have
    assert jobs["job_bi"]["missingSkills"] == ["Power BI", "Forecasting"]
    assert jobs["job_web"]["recommended"] is False  # weak fits are never "recommended"

    # The same JD again is deduplicated, not stored twice.
    await client.post(f"/api/resumes/{resume['id']}/analyze", json={"jobDescription": JD_TEXT + "  "}, headers=headers)
    again = (await client.get("/api/job-descriptions", headers=headers)).json()["data"]
    assert len(again) == 1 and again[0]["useCount"] == 2

    other = await signed_up(client, "stranger")
    assert (await client.get("/api/job-descriptions", headers=other)).json()["data"] == []
    assert (await client.delete(f"/api/job-descriptions/{saved[0]['id']}", headers=headers)).status_code == 204


@pytest.fixture
def fake_feed(monkeypatch):
    """Feed with Apify and the AI structuring step mocked; counts upstream searches."""
    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(get_settings(), "apify_api_token", "apify-test-token")

    async def search(query, location, limit, sources):
        calls.append((query, location))
        return {"jobs": [
            {"source": "naukri", "title": f"{query} Trainee", "company": "Acme", "location": "Pune", "url": f"https://naukri.example/{query}", "description": "SQL and Python"},
        ]}

    async def structure(listings):
        return [
            job_ingest._Listing(
                index=i, isJobPosting=True, title=raw["title"], company=raw["company"], city="Pune", workType="onsite", level="entry",
                roleType="Data & Analytics", experience="0-1 yrs", skills=["SQL", "Python"], salary="", jobType="Full-time",
                about="", responsibilities=[], requirements=[], niceToHave=[], stretchSkill="",
            )
            for i, raw in enumerate(listings)
        ]

    monkeypatch.setattr(job_feed, "search_jobs_parallel", search)
    monkeypatch.setattr(job_ingest, "_structure", structure)
    return calls


async def test_personal_feed_searches_for_the_users_roles(client, fake_feed):
    headers = await signed_up(client, "feed-user")
    await client.post("/api/resumes", json=_data_resume(), headers=headers)
    await _make_pro("feed-user")

    summary = await job_feed.refresh("feed-user", "scheduled")
    assert summary["query"] == "Data Analyst" and summary["created"] == 1 and summary["fromCache"] is False
    assert fake_feed == [("Data Analyst", "India")]
    status = (await client.get("/api/jobs/feed", headers=headers)).json()["data"]
    assert status["lastRefreshAt"] and status["scheduledLeft"] == get_settings().job_feed_scheduled_per_month - 1

    jobs = (await client.get("/api/jobs", headers=headers)).json()["data"]
    assert jobs[0]["title"] == "Data Analyst Trainee" and jobs[0]["source"] == "naukri" and jobs[0]["matchPercent"] > 50

    # A second Pro user with the same search reuses the cached listings: no extra Apify cost.
    twin = await signed_up(client, "feed-twin")
    await client.post("/api/resumes", json=_data_resume(), headers=twin)
    await _make_pro("feed-twin")
    cached = await job_feed.refresh("feed-twin", "scheduled")
    assert cached["fromCache"] is True and len(fake_feed) == 1

    # Free users never trigger searches.
    free = await signed_up(client, "feed-free")
    assert "not a Pro user" in (await job_feed.refresh("feed-free", "scheduled"))["errors"]


async def test_feed_respects_monthly_caps(client, fake_feed):
    await signed_up(client, "capped")
    await client.post("/api/resumes", json=_data_resume(), headers=await signed_up(client, "capped"))
    await _make_pro("capped")
    await mongo.job_feed_usage().insert_one({"_id": job_feed.month_key("capped"), "uid": "capped", "jd": 5, "scheduled": 0})

    jd_run = await job_feed.refresh("capped", "jd")
    assert "monthly jd search limit reached" in jd_run["errors"] and fake_feed == []

    await mongo.job_feed_usage().update_one({"_id": f"apify:{utcnow().strftime('%Y-%m')}"}, {"$set": {"results": 40}}, upsert=True)
    with pytest.raises(apify_jobs.ApifyBudgetExceeded):  # APIFY_MONTHLY_RESULT_LIMIT=40 in conftest
        await apify_jobs.search_jobs_parallel("Data Analyst", "India", 10, ["indeed"])


async def test_due_feeds_refresh_on_schedule(client, fake_feed):
    headers = await signed_up(client, "due")
    await client.put("/api/profile", json={"name": "Due", "targetRoles": ["Business Analyst"], "location": "Pune"}, headers=headers)
    await _make_pro("due")
    await mongo.users().update_one({"_id": "due"}, {"$set": {"jobFeed.lastRefreshAt": utcnow() - timedelta(days=10)}})

    assert await job_feed.run_scheduled() == 1
    assert fake_feed == [("Business Analyst", "Pune")]
    assert await job_feed.run_scheduled() == 0  # just refreshed, not due again
