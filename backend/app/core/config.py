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
    # Plan defaults. They seed the `plans` collection on first start; after that the documents in
    # MongoDB are the source of truth (edit them to change prices or limits without a deploy).
    # Daily AI actions per user (generation, tailoring, parsing, rewrites, interviews). Chat has its own cap.
    ai_daily_limit_free: int = 15
    ai_daily_limit_paid: int = 300
    chat_daily_limit_free: int = 10
    chat_daily_limit_paid: int = 100
    free_mock_interviews: int = 1

    # Plans and quotas (see developer-handoff/07-SUBSCRIPTION-USAGE.md)
    enforce_plan_limits: bool = True
    free_resume_limit: int = 5
    single_resume_price_inr: int = 49
    monthly_price_inr: int = 199
    monthly_plan_days: int = 30

    # Free-resume device guard: free resumes are also capped per device (browser id sent by the
    # frontend) and per device + IP pair, so new accounts on the same laptop don't reset the
    # allowance while other devices on the same network are unaffected. Only salted hashes are stored.
    free_resume_guard_enabled: bool = True
    free_resumes_per_device: int = 5
    free_resume_guard_hash_salt: str = ""

    # Payments (Razorpay)
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""

    # Live job search through Apify actors (raw token or an Apify URL containing ?token=)
    apify_api_token: str = ""
    apify_linkedin_enabled: bool = False
    # Actor IDs per job board (username/actor-name). Override when an actor is retired from the store.
    apify_actor_indeed: str = "misceres/indeed-scraper"
    apify_actor_naukri: str = "memo23/naukri-scraper"
    apify_actor_linkedin: str = "fetchclub/linkedin-jobs-scraper"
    apify_actor_internshala: str = "crawloop/internshala-scraper"
    apify_actor_foundit: str = "crawloop/foundit-jobs-scraper"
    apify_actor_google_search: str = "apify/google-search-scraper"

    # Personal job feed (Pro). Searches come from each user's resume and saved job descriptions.
    job_feed_sources: str = "indeed,naukri,linkedin,internshala,foundit"
    job_feed_results_per_search: int = 10
    job_feed_refresh_days: float = 3.5  # automatic refresh about twice a week
    job_feed_scheduled_per_month: int = 8
    job_feed_jd_searches_per_month: int = 5
    job_feed_cache_hours: int = 24
    # Hard stop for Apify spend across all users: listings fetched per calendar month (0 = no cap).
    apify_monthly_result_limit: int = 3000
    apify_cost_per_1000_usd: float = 5.0  # only used for the spend estimate in logs

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

    # Career assistant: a chat session stays open this long, then its key points are saved to the
    # user's long-term memory and the transcript is deleted.
    chat_session_hours: int = 48
    chat_history_turns: int = 20

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
