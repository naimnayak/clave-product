"""Demo job catalog converted from the frontend mocks (src/mocks/jobs.mock.ts, jobDetails.mock.ts, companies.mock.ts).

Loaded into MongoDB on startup when the jobs collection is empty (SEED_DEMO_JOBS=true), so the Jobs pages
work against the API until a real job ingestion pipeline exists.
"""

import json
import logging
from datetime import timedelta
from pathlib import Path

from app.core.utils import utcnow
from app.db import mongo

logger = logging.getLogger(__name__)
_SEED_FILE = Path(__file__).with_name("jobs_seed.json")


async def seed_demo_jobs() -> None:
    if await mongo.jobs().estimated_document_count() > 0:
        return
    data = json.loads(_SEED_FILE.read_text(encoding="utf-8"))
    now = utcnow()
    jobs = []
    for job in data["jobs"]:
        days = int(job.pop("postedDaysAgo", 0))
        job.pop("matchPercent", None)  # match is computed per user
        jobs.append({"_id": job.pop("id"), **job, "postedAt": now - timedelta(days=days), "source": "seed", "active": True})
    await mongo.jobs().insert_many(jobs)
    await mongo.companies().delete_many({})
    await mongo.companies().insert_many([{"_id": name, **info} for name, info in data["companies"].items()])
    logger.info("Seeded %d demo jobs and %d companies.", len(jobs), len(data["companies"]))
