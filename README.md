# Clave

AI career workspace for students, freshers and early-career professionals: one Career Profile, AI-generated and tailored ATS-friendly resumes, ATS analysis, job matching, application tracking, a career assistant and mock interviews.

## Stack

- **Frontend** (`src/`): React 19, Vite, TypeScript, Tailwind CSS v4, Zustand, Firebase Auth (web SDK).
- **Backend** (`backend/`): FastAPI, MongoDB (PyMongo async), Firebase Admin token verification, an AI model provider for AI features, Razorpay (payments), Apify (job listings), optional SMTP and upload bucket.

## Run locally

```bash
# Backend (from backend/), needs MongoDB running
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env               # fill in; service-account files go in backend/secrets/
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend (from repo root)
cp .env.example .env.local         # Firebase web config
npm install
npm run dev                        # http://localhost:5173, /api is proxied to :8000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type check and production build to `dist/` |
| `npm run lint` | oxlint |
| `backend/.venv/bin/pytest` (from `backend/`) | Backend tests |
| `backend/.venv/bin/python -m app.cli.ingest_jobs` (from `backend/`) | One job-feed ingestion pass |

## Documentation

See [developer-handoff/](developer-handoff/README.md) for the database schema, API reference, auth, AI architecture, uploads, plans, environment variables, testing and deployment.
