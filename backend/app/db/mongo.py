"""MongoDB access through PyMongo's native async client (Motor reached end of life in May 2026).

Every user-owned document stores the Firebase `uid`, and every query filters on it.
"""

from datetime import timedelta

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.asynchronous.collection import AsyncCollection
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings

_client: AsyncMongoClient | None = None


def client() -> AsyncMongoClient:
    global _client
    if _client is None:
        _client = AsyncMongoClient(
            get_settings().mongo_url,
            tz_aware=True,
            serverSelectionTimeoutMS=5000,
            appname="clave-backend",
        )
    return _client


def database() -> AsyncDatabase:
    return client()[get_settings().mongo_db_name]


def users() -> AsyncCollection:
    return database()["users"]


def profiles() -> AsyncCollection:
    return database()["profiles"]


def resumes() -> AsyncCollection:
    return database()["resumes"]


def files() -> AsyncCollection:
    return database()["files"]


def jobs() -> AsyncCollection:
    return database()["jobs"]


def companies() -> AsyncCollection:
    return database()["companies"]


def saved_jobs() -> AsyncCollection:
    return database()["saved_jobs"]


def payments() -> AsyncCollection:
    return database()["payments"]


def interview_sessions() -> AsyncCollection:
    return database()["interview_sessions"]


def job_search_cache() -> AsyncCollection:
    return database()["job_search_cache"]


def free_resume_claims() -> AsyncCollection:
    return database()["free_resume_claims"]


def applications() -> AsyncCollection:
    return database()["applications"]


def notifications() -> AsyncCollection:
    return database()["notifications"]


def sessions() -> AsyncCollection:
    return database()["sessions"]


def ai_usage() -> AsyncCollection:
    return database()["ai_usage"]


def contact_messages() -> AsyncCollection:
    return database()["contact_messages"]


def feedback() -> AsyncCollection:
    return database()["feedback"]


def ingest_runs() -> AsyncCollection:
    return database()["ingest_runs"]


async def ping() -> None:
    await client().admin.command("ping")


async def ensure_indexes() -> None:
    settings = get_settings()
    await resumes().create_index([("uid", ASCENDING), ("updatedAt", DESCENDING)])
    await files().create_index([("uid", ASCENDING)])
    await files().create_index(
        [("createdAt", ASCENDING)],
        expireAfterSeconds=int(timedelta(days=settings.upload_retention_days).total_seconds()),
    )
    await saved_jobs().create_index([("uid", ASCENDING), ("jobId", ASCENDING)], unique=True)
    await payments().create_index([("uid", ASCENDING)])
    await payments().create_index([("paymentId", ASCENDING)], unique=True, sparse=True)
    await interview_sessions().create_index([("uid", ASCENDING), ("createdAt", DESCENDING)])
    await job_search_cache().create_index([("createdAt", ASCENDING)], expireAfterSeconds=6 * 60 * 60)
    await free_resume_claims().create_index([("uid", ASCENDING)])
    await free_resume_claims().create_index([("ipHash", ASCENDING)])
    await free_resume_claims().create_index([("fingerprintHash", ASCENDING)], sparse=True)
    await applications().create_index([("uid", ASCENDING), ("jobId", ASCENDING)], unique=True)
    await notifications().create_index([("uid", ASCENDING), ("createdAt", DESCENDING)])
    await notifications().create_index([("expireAt", ASCENDING)], expireAfterSeconds=0)
    await sessions().create_index([("uid", ASCENDING), ("lastActiveAt", DESCENDING)])
    await sessions().create_index([("expireAt", ASCENDING)], expireAfterSeconds=0)
    await ai_usage().create_index([("expireAt", ASCENDING)], expireAfterSeconds=0)
    await jobs().create_index([("externalId", ASCENDING)], unique=True, sparse=True)
    await jobs().create_index([("active", ASCENDING), ("postedAt", DESCENDING)])


async def close() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None
