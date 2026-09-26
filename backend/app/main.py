"""Clave API: FastAPI app factory, middleware, startup checks and background maintenance.

Run locally from backend/:  .venv/bin/uvicorn app.main:app --reload --port 8000
"""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import account, ai, applications, billing, files, jobs, notifications, profile, resumes, support
from app.core.config import get_settings
from app.core.errors import UnhandledErrorMiddleware, register_error_handlers
from app.core.limiter import limiter
from app.core.security import init_firebase
from app.core.utils import ok
from app.db import mongo
from app.seed import seed_demo_jobs
from app.services import email, storage
from app.services.ai_client import is_configured as ai_configured
from app.services.job_ingest import ingest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# httpx logs full request URLs at INFO, which include API tokens in query strings and provider model paths.
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("clave")
settings = get_settings()


async def _maintenance_loop() -> None:
    """Job feed ingestion (when JOB_INGEST_INTERVAL_HOURS > 0) and expired-upload cleanup."""
    hours = settings.job_ingest_interval_hours if settings.job_ingest_interval_hours > 0 else 12
    await asyncio.sleep(60)  # let the server finish starting
    while True:
        try:
            if settings.job_ingest_interval_hours > 0:
                await ingest()
            await storage.cleanup_expired()
        except Exception:
            logger.exception("Background maintenance failed")
        await asyncio.sleep(hours * 3600)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_firebase()
    await mongo.ping()
    await mongo.ensure_indexes()
    if settings.seed_demo_jobs:
        await seed_demo_jobs()

    if not ai_configured():
        logger.warning("AI model is not configured (AI_MODEL / AI_MODEL_LITE); AI endpoints will return 503.")
    elif settings.ai_use_cloud_project and not settings.resolve_path(settings.ai_credentials_file).exists():
        logger.warning("AI credentials file is missing; AI calls will use Application Default Credentials.")
    if not (settings.razorpay_key_id and settings.razorpay_key_secret):
        logger.warning("Razorpay keys are not set; payment endpoints will return 503.")
    if not settings.apify_api_token:
        logger.warning("APIFY_API_TOKEN is not set; live job search and the job feed are disabled.")
    if not email.is_configured():
        logger.warning("SMTP is not configured; emails are skipped (contact messages are still stored).")
    if not settings.enforce_plan_limits:
        logger.warning("ENFORCE_PLAN_LIMITS=false: resume quotas are not enforced (development only).")

    task = asyncio.create_task(_maintenance_loop())
    logger.info("Clave API ready (db=%s, ai=%s, uploads=%s)", settings.mongo_db_name, "configured" if ai_configured() else "off", "bucket" if storage.uses_bucket() else "mongo")
    yield
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task
    await mongo.close()


app = FastAPI(
    title="Clave API",
    version="1.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)
app.state.limiter = limiter
register_error_handlers(app)
# Order matters: the catch-all sits inside CORS so browsers can read 500 responses.
app.add_middleware(UnhandledErrorMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=False,  # Bearer tokens only, no cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Clave-Session"],
    expose_headers=["Content-Disposition"],
)

api = APIRouter(prefix="/api")
for module in (account, profile, resumes, files, ai, jobs, applications, notifications, support, billing):
    api.include_router(module.router)


@api.get("/health", tags=["System"])
async def health():
    try:
        await mongo.ping()
        database = "ok"
    except Exception:  # report, don't crash, so load balancers see the failure
        database = "unavailable"
    return ok({"status": "ok" if database == "ok" else "degraded", "database": database, "ai": "configured" if ai_configured() else "off"})


app.include_router(api)
