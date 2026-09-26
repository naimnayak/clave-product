# 12 · Deployment Guide

## Components

| Component | Needed | Notes |
|---|---|---|
| FastAPI backend (uvicorn) | Yes | Python 3.11+ virtualenv (developed on 3.13), `backend/requirements.txt` |
| MongoDB | Yes | Replica set or managed cluster recommended; TTL indexes are created on startup |
| Firebase project | Yes | Authentication + service account for `firebase-admin` |
| AI model provider | For AI features | Service account or API key, model IDs in env |
| Static hosting + reverse proxy | Yes | Serves `dist/`, proxies `/api` to the backend |
| Upload bucket | Optional | Otherwise uploads live in MongoDB |
| SMTP | Optional | Otherwise emails are skipped |
| Apify | Optional | Live job search and job feed |
| Razorpay | Optional | Payments return 503 until configured |
| Redis | When running > 1 worker | Shared rate-limit counters |

## Backend

```bash
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env              # fill in production values (see 09)
# place service-account JSON files in backend/secrets/ (or point the env vars elsewhere)
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
```

Production settings:
- `APP_ENV=production` (hides `/api/docs`).
- `ALLOWED_ORIGINS` and `WEB_BASE_URL` set to the real web origin.
- `ENFORCE_PLAN_LIMITS=true`.
- `MONGO_URL` pointing at the production cluster (TLS, authenticated user).
- AI variables (`AI_USE_CLOUD_PROJECT`, `AI_CREDENTIALS_FILE` or `AI_API_KEY`, `AI_MODEL`, `AI_MODEL_LITE`).
- With multiple uvicorn workers or instances: `RATE_LIMIT_STORAGE_URI=redis://…` (install `redis`), and keep job ingestion on one scheduler (the lease prevents overlap anyway).

Startup (`lifespan`) initializes Firebase (fails fast if the service account is missing), pings MongoDB, creates indexes, seeds demo jobs if the catalog is empty, and logs warnings for anything unconfigured (AI, Razorpay, Apify, SMTP, `ENFORCE_PLAN_LIMITS=false`).

Health check: `GET /api/health` → `status: "ok"` or `"degraded"` (database unreachable).

Run it under a process manager (systemd, a container platform, etc.) behind HTTPS.

## Firebase

- Enable the sign-in providers the app uses in Firebase Authentication.
- Add the production domain to **Authentication → Settings → Authorized domains**.
- Download a service account for the backend (`FIREBASE_SERVICE_ACCOUNT`).
- Put the web app config into the frontend `VITE_FIREBASE_*` variables at build time.

## Frontend

```bash
cp .env.example .env.local        # or provide VITE_* in the build environment
npm ci
npm run build                     # outputs dist/
```

Serve `dist/` as a static single-page app (fall back to `index.html` for unknown paths) and reverse-proxy `/api` to the backend, so `VITE_API_BASE_URL=/api` works unchanged. Example nginx:

```nginx
location /api/ { proxy_pass http://127.0.0.1:8000; proxy_set_header Host $host;
                 proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                 proxy_set_header X-Forwarded-Proto $scheme; client_max_body_size 12m;
                 proxy_read_timeout 120s; }
location / { try_files $uri /index.html; }
```

Allow request bodies above 10 MB for uploads and read timeouts above 90 s for AI calls.

## Optional services

- **Uploads bucket:** set `UPLOAD_BUCKET` (and `UPLOAD_PREFIX`); the Firebase service account needs write access. Expired objects are removed by the maintenance loop or the ingest CLI.
- **SMTP:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_FROM`, `SUPPORT_INBOX`.
- **Job feed:** set `APIFY_API_TOKEN`. Either `JOB_INGEST_INTERVAL_HOURS=12` (runs inside the API), or cron:
  ```
  0 */12 * * * cd /srv/clave/backend && .venv/bin/python -m app.cli.ingest_jobs
  ```
  With `JOB_INGEST_INTERVAL_HOURS=0`, the API still cleans up expired bucket uploads every 12 hours.
- **Payments:** set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. The checkout UI and webhook are Not implemented yet.

## Pre-launch checklist

- [ ] `APP_ENV=production`, `ENFORCE_PLAN_LIMITS=true`, correct `ALLOWED_ORIGINS`
- [ ] Production domain in Firebase authorized domains
- [ ] Secrets stored outside git (env/secret manager); `backend/secrets/` not in the image layer history
- [ ] MongoDB backups enabled
- [ ] `/api/health` monitored
- [ ] HTTPS on the web origin and API
- [ ] Redis rate-limit storage if scaled out
