"""Import live job listings once:  .venv/bin/python -m app.cli.ingest_jobs

Suitable for cron, e.g. every 12 hours:  0 */12 * * * cd /srv/clave/backend && .venv/bin/python -m app.cli.ingest_jobs
"""

import asyncio
import json
import logging

from app.core.security import init_firebase
from app.db import mongo
from app.services import storage
from app.services.job_ingest import ingest


async def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)  # its URLs contain the Apify token
    init_firebase()
    await mongo.ping()
    await mongo.ensure_indexes()
    try:
        summary = await ingest()
        summary["uploadsRemoved"] = await storage.cleanup_expired()
    finally:
        await mongo.close()
    print(json.dumps(summary, default=str, indent=2))
    return 1 if summary.get("errors") and not summary.get("created") and not summary.get("refreshed") else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
