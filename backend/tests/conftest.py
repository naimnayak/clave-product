"""Test setup: a throwaway MongoDB database, fake Firebase tokens and no real AI, email or payment calls.

Run from backend/:  .venv/bin/pytest
Needs a MongoDB server (MONGO_URL, default mongodb://localhost:27017). Each test gets an empty database
named by TEST_MONGO_DB_NAME (default clave_test), which is dropped before and after the test.
"""

import os

# Settings are read once (lru_cache), so the environment must be set before the app is imported.
# Environment variables take precedence over backend/.env.
os.environ.update({
    "APP_ENV": "test",
    "MONGO_DB_NAME": os.environ.get("TEST_MONGO_DB_NAME", "clave_test"),
    "ENFORCE_PLAN_LIMITS": "true",
    "FREE_RESUME_LIMIT": "1",
    "FREE_RESUME_GUARD_ENABLED": "false",
    "AI_USE_CLOUD_PROJECT": "false",
    "AI_API_KEY": "test-key",
    "AI_MODEL": "test-model",
    "AI_MODEL_LITE": "test-model-lite",
    "AI_DAILY_LIMIT_FREE": "3",
    "AI_DAILY_LIMIT_PAID": "5",
    "CHAT_DAILY_LIMIT_FREE": "4",
    "CHAT_DAILY_LIMIT_PAID": "50",
    "FREE_MOCK_INTERVIEWS": "1",
    "FREE_RESUMES_PER_DEVICE": "2",
    "FREE_RESUME_GUARD_HASH_SALT": "test-salt",
    "RAZORPAY_WEBHOOK_SECRET": "whsec_test",
    "APIFY_MONTHLY_RESULT_LIMIT": "40",
    "AI_RATE_LIMIT": "100/minute",
    "RATE_LIMIT_STORAGE_URI": "memory://",
    "RAZORPAY_KEY_ID": "rzp_test_key",
    "RAZORPAY_KEY_SECRET": "rzp_test_secret",
    "APIFY_API_TOKEN": "",
    "SMTP_HOST": "",
    "UPLOAD_BUCKET": "",
    "SEED_DEMO_JOBS": "false",
    "JOB_INGEST_INTERVAL_HOURS": "0",
})

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.api import account as account_api  # noqa: E402
from app.core import security  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.limiter import limiter  # noqa: E402
from app.db import mongo  # noqa: E402
from app.main import app  # noqa: E402

assert get_settings().mongo_db_name != "clave", "Refusing to run tests against the main database"


def pytest_collection_modifyitems(items):
    for item in items:
        item.add_marker(pytest.mark.anyio)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _fake_verify(token: str, **_kwargs) -> dict:
    """Test tokens look like `test:<uid>`; anything else is rejected like an invalid Firebase token."""
    if not token.startswith("test:"):
        raise ValueError("invalid token")
    uid = token.removeprefix("test:")
    return {
        "uid": uid,
        "email": f"{uid}@example.com",
        "name": uid.replace("-", " ").title(),
        "email_verified": True,
        "firebase": {"sign_in_provider": "password"},
    }


@pytest.fixture(autouse=True)
def fake_firebase(monkeypatch):
    monkeypatch.setattr(security.firebase_auth, "verify_id_token", _fake_verify)
    monkeypatch.setattr(account_api, "firebase_login_info", lambda uid: {"providers": ["password"], "passwordUpdatedAt": None})
    monkeypatch.setattr(account_api, "delete_firebase_user", lambda uid, attempts=3: True)


@pytest.fixture
async def client():
    mongo._client = None  # the async client is bound to the running event loop
    await mongo.client().drop_database(get_settings().mongo_db_name)
    await mongo.ensure_indexes()
    limiter.reset()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
    await mongo.client().drop_database(get_settings().mongo_db_name)
    await mongo.close()
