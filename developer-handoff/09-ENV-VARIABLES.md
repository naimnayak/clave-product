# 09 · Environment Variables

Never commit real values. Backend values live in `backend/.env` (template: `backend/.env.example`), read by `app/core/config.py` (pydantic-settings, case-insensitive, unknown keys ignored). Relative file paths resolve against `backend/`.

## Backend

### App
| Variable | Default | Purpose |
|---|---|---|
| APP_ENV | development | `production` disables `/api/docs` and `/api/openapi.json` |
| ALLOWED_ORIGINS | http://localhost:5173,http://127.0.0.1:5173 | Comma-separated CORS origins |
| WEB_BASE_URL | http://localhost:5173 | Base URL used in email links |

### Database & auth
| Variable | Default | Purpose |
|---|---|---|
| MONGO_URL | mongodb://localhost:27017 | MongoDB connection string |
| MONGO_DB_NAME | clave | Database name |
| FIREBASE_SERVICE_ACCOUNT | secrets/firebase-service-account.json | Firebase Admin service-account file (required to start) |

### AI
| Variable | Default | Purpose |
|---|---|---|
| AI_USE_CLOUD_PROJECT | true | `true`: authenticate with a service account; `false`: use `AI_API_KEY` |
| AI_CREDENTIALS_FILE | secrets/ai-service-account.json | Service-account file for the AI model provider |
| AI_API_KEY | (empty) | AI model provider API key (when `AI_USE_CLOUD_PROJECT=false`) |
| AI_MODEL | (empty) | Main model ID supplied by the AI provider |
| AI_MODEL_LITE | (empty) | Lite model ID supplied by the AI provider, for short tasks |
| AI_THINKING_LEVEL | low | `minimal`/`low`/`medium`/`high`; empty disables |
| AI_TIMEOUT_SECONDS | 90 | Per-request timeout |
| AI_RATE_LIMIT | 30/minute | Per-user burst limit on AI endpoints (slowapi syntax) |
| AI_DAILY_LIMIT_FREE | 30 | Daily AI actions, free users |
| AI_DAILY_LIMIT_PAID | 300 | Daily AI actions, active Monthly plan |
| RATE_LIMIT_STORAGE_URI | memory:// | Limiter storage; `redis://host:6379` for multiple processes |
| AI_CLOUD_PROJECT | ats-resume-grader | Cloud project the AI model runs in (when `AI_USE_CLOUD_PROJECT=true`) |
| AI_CLOUD_LOCATION | global | Region for the AI model endpoint |

### Plans & payments
| Variable | Default | Purpose |
|---|---|---|
| ENFORCE_PLAN_LIMITS | true | Resume quotas; keep `true` in production |
| FREE_RESUME_LIMIT | 1 | Lifetime free resumes |
| SINGLE_RESUME_PRICE_INR | 49 | Single Resume price |
| MONTHLY_PRICE_INR | 199 | Monthly Unlimited price |
| MONTHLY_PLAN_DAYS | 30 | Monthly plan length |
| FREE_RESUME_GUARD_ENABLED | false | One free resume per network/device |
| FREE_RESUME_GUARD_HASH_SALT | (empty) | Salt for guard hashes (set when enabled) |
| RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET | (empty) | Razorpay keys; payment endpoints return 503 until set |

### Jobs
| Variable | Default | Purpose |
|---|---|---|
| APIFY_API_TOKEN | (empty) | Apify token (or an Apify URL containing `?token=`); enables live search and the job feed |
| APIFY_LINKEDIN_ENABLED | false | Allow the LinkedIn source |
| APIFY_ACTOR_INDEED / _NAUKRI / _LINKEDIN / _GOOGLE_SEARCH / _NAUKRI_STRICT | built-in actor ids | Optional actor overrides (read via `os.getenv` in `apify_jobs.py`) |
| SEED_DEMO_JOBS | true | Load demo jobs when the jobs collection is empty |
| JOB_INGEST_INTERVAL_HOURS | 0 | Run the job feed inside the API every N hours; 0 = use cron |
| JOB_INGEST_QUERIES | (empty) | Comma-separated queries; empty = users' most common target roles |
| JOB_INGEST_LOCATION | India | Search location |
| JOB_INGEST_SOURCES | indeed,naukri | Sources for the feed |
| JOB_INGEST_PER_QUERY | 10 | Listings per query |
| JOB_INGEST_MAX_QUERIES | 6 | Max queries per run |
| JOB_MAX_AGE_DAYS | 30 | Deactivate feed jobs not seen for this long |
| JOB_MATCH_NOTIFY_THRESHOLD | 85 | Match % that triggers a "new jobs" notification |

### Uploads
| Variable | Default | Purpose |
|---|---|---|
| MAX_UPLOAD_BYTES | 10485760 | 10 MB upload cap |
| UPLOAD_RETENTION_DAYS | 7 | Upload lifetime |
| UPLOAD_BUCKET | (empty) | Storage bucket name; empty = store in MongoDB |
| UPLOAD_PREFIX | clave-uploads | Object prefix in the bucket |

### Email & notifications
| Variable | Default | Purpose |
|---|---|---|
| SMTP_HOST | (empty) | Empty = emails skipped |
| SMTP_PORT | 587 | 465 uses implicit TLS |
| SMTP_USERNAME / SMTP_PASSWORD | (empty) | SMTP login |
| SMTP_USE_TLS | true | STARTTLS on non-465 ports |
| EMAIL_FROM | Clave <hello@clave.app> | Sender |
| SUPPORT_INBOX | support@clave.app | Receives contact and feedback messages |
| NOTIFICATION_RETENTION_DAYS | 90 | Notification TTL |

## Frontend

Set in `.env.local` (template: `.env.example`). All are public at build time; don't put secrets here.

| Variable | Purpose |
|---|---|
| VITE_API_BASE_URL | API base, default `/api` (proxied in dev, reverse-proxied in prod) |
| VITE_FIREBASE_API_KEY | Firebase web config |
| VITE_FIREBASE_AUTH_DOMAIN | Firebase web config |
| VITE_FIREBASE_PROJECT_ID | Firebase web config |
| VITE_FIREBASE_STORAGE_BUCKET | Firebase web config |
| VITE_FIREBASE_MESSAGING_SENDER_ID | Firebase web config |
| VITE_FIREBASE_APP_ID | Firebase web config |
