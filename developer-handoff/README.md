# Clave Developer Handoff

These documents describe the system as it is implemented in this repository. When code and docs disagree, the code wins; please update the doc.

Clave helps students, freshers and early-career professionals keep one Career Profile, generate and tailor ATS-friendly resumes from it, check ATS fit, practise interviews and find jobs.

## Stack

| Layer | Implementation |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 (`src/`). Zustand stores, React Router. |
| API client | `src/services/apiClient.ts`: sends the Firebase ID token as `Authorization: Bearer`, a per-browser `X-Clave-Session` id, unwraps `{ data }`, maps `{ error }` to `ApiError`. Vite proxies `/api` to `http://localhost:8000`. |
| Backend | FastAPI (`backend/app`), all routes under `/api`. |
| Database | MongoDB via PyMongo `AsyncMongoClient` (`app/db/mongo.py`). |
| Auth | Firebase Authentication; `firebase-admin` verifies ID tokens (`app/core/security.py`). Server-side device sessions (`app/services/sessions.py`). |
| AI | An AI model provider, called through the AI provider's Python SDK (see `requirements.txt`), with schema-validated structured output (`app/services/ai_client.py`, `ai_tasks.py`). |
| Payments | Razorpay one-time orders (`app/api/billing.py`). Checkout UI: Not implemented yet. |
| Uploads | Optional cloud bucket, otherwise stored in MongoDB; 7-day retention (`app/services/storage.py`). |
| Jobs | Demo seed catalog, plus a job feed from Apify actors structured by the AI model (`apify_jobs.py`, `job_ingest.py`). |
| Email | Optional SMTP (`app/services/email.py`). |
| Rate limits | slowapi (`app/core/limiter.py`) plus daily AI allowances per plan (`app/services/quota.py`). |

## Documents

| File | Topic |
|---|---|
| [01-DATABASE-SCHEMA.md](01-DATABASE-SCHEMA.md) | MongoDB collections, key fields, indexes and TTLs |
| [02-API-ENDPOINTS.md](02-API-ENDPOINTS.md) | Every endpoint, envelope and error codes |
| [03-PYDANTIC-SCHEMAS.md](03-PYDANTIC-SCHEMAS.md) | Request and document models |
| [04-AUTHENTICATION-SECURITY.md](04-AUTHENTICATION-SECURITY.md) | Firebase auth, sessions, CORS, rate limits |
| [05-AI-SERVICE-ARCHITECTURE.md](05-AI-SERVICE-ARCHITECTURE.md) | AI client, tasks, anti-fabrication, limits |
| [06-FILE-UPLOAD-PIPELINE.md](06-FILE-UPLOAD-PIPELINE.md) | Upload, extraction, parsing, retention |
| [07-SUBSCRIPTION-USAGE.md](07-SUBSCRIPTION-USAGE.md) | Plans, credits, payments |
| [08-PROJECT-STRUCTURE.md](08-PROJECT-STRUCTURE.md) | Repository layout |
| [09-ENV-VARIABLES.md](09-ENV-VARIABLES.md) | Backend and frontend configuration |
| [10-TEST-PLAN.md](10-TEST-PLAN.md) | Tests, lint, build, CI |
| [11-SEED-MOCK-DATA.md](11-SEED-MOCK-DATA.md) | Demo jobs and the job feed |
| [12-DEPLOYMENT-GUIDE.md](12-DEPLOYMENT-GUIDE.md) | Running in production |

`API_DOCUMENTATION.md` is kept only as a pointer to 02.

## Local development

```bash
# Backend (from backend/)
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # fill in; put service-account files in backend/secrets/
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (from repo root)
cp .env.example .env.local      # Firebase web config
npm install && npm run dev      # http://localhost:5173, /api proxied to :8000
```

MongoDB must be reachable at `MONGO_URL`. Interactive API docs are at `/api/docs` when `APP_ENV` is not `production`.

## Not implemented yet

- Payments checkout UI in the frontend (the backend order/verify endpoints exist).
- Razorpay webhook handling (payments are only confirmed through `POST /api/payments/verify`).
