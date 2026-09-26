"""Application settings, read from environment variables and backend/.env."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    # Comma-separated list of browser origins allowed to call the API.
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # MongoDB
    mongo_url: str = "mongodb://localhost:27017"
    mongo_db_name: str = "clave"

    # Firebase Auth: the Admin SDK verifies the ID tokens the frontend sends.
    firebase_service_account: str = "secrets/firebase-service-account.json"

    # AI model provider. By default it runs inside the GCP project (billed there) with a service
    # account; set AI_USE_CLOUD_PROJECT=false to use a provider API key instead.
    ai_use_cloud_project: bool = True
    ai_cloud_project: str = "ats-resume-grader"
    ai_cloud_location: str = "global"
    ai_credentials_file: str = "secrets/ai-service-account.json"
    ai_api_key: str = ""
    # Model IDs are configuration only (backend/.env). The lite model handles short, cheap tasks.
    ai_model: str = ""
    ai_model_lite: str = ""
    # Reasoning effort for models that support it ("minimal", "low", "medium", "high"); "" disables it.
    ai_thinking_level: str = "low"
    ai_timeout_seconds: float = 90
    # Daily AI actions per user (generation, tailoring, parsing, rewrites, chat, interviews).
    ai_daily_limit_free: int = 30
    ai_daily_limit_paid: int = 300

    # Plans and quotas (see developer-handoff/07-SUBSCRIPTION-USAGE.md)
    enforce_plan_limits: bool = True
    free_resume_limit: int = 1
    single_resume_price_inr: int = 49
    monthly_price_inr: int = 199
    monthly_plan_days: int = 30

    # Free-resume abuse guard ported from the ATS backend. Off by default because
    # students often share campus or NAT IP addresses.
    free_resume_guard_enabled: bool = False
    free_resume_guard_hash_salt: str = ""

    # Payments (Razorpay)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # Live job search through Apify actors (raw token or an Apify URL containing ?token=)
    apify_api_token: str = ""
    apify_linkedin_enabled: bool = False

    # Load the demo job catalog (converted from the frontend mocks) when the jobs collection is empty.
    # Demo jobs are switched off automatically once the job feed has imported real listings.
    seed_demo_jobs: bool = True

    # Job feed: imports live listings through Apify, then the AI model structures them.
    # 0 = never run inside the API (use `python -m app.cli.ingest_jobs` from cron instead).
    job_ingest_interval_hours: float = 0
    job_ingest_queries: str = ""  # comma-separated; empty = the most common target roles of Clave users
    job_ingest_location: str = "India"
    job_ingest_sources: str = "indeed,naukri"
    job_ingest_per_query: int = 10
    job_ingest_max_queries: int = 6
    job_max_age_days: int = 30
    job_match_notify_threshold: int = 85

    # Uploads: stored in Cloud Storage when UPLOAD_BUCKET is set, otherwise inside MongoDB.
    max_upload_bytes: int = 10 * 1024 * 1024
    upload_retention_days: int = 7
    upload_bucket: str = ""
    upload_prefix: str = "clave-uploads"

    # Email (SMTP). When unset, emails are skipped and contact messages are only stored.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "Clave <hello@clave.app>"
    support_inbox: str = "support@clave.app"
    web_base_url: str = "http://localhost:5173"

    notification_retention_days: int = 90

    # Per-user burst limit for AI endpoints (slowapi syntax), and where limiter counters live.
    # Use redis://host:6379 when running more than one server process (needs the `redis` package).
    ai_rate_limit: str = "30/minute"
    rate_limit_storage_uri: str = "memory://"

    def resolve_path(self, value: str) -> Path:
        path = Path(value).expanduser()
        return path if path.is_absolute() else BASE_DIR / path

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
