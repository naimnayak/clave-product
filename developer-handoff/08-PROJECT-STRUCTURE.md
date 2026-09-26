# 08 · Project Structure

```
clave-product/
├── index.html, vite.config.ts        # Vite; alias @ → src; dev proxy /api → http://localhost:8000
├── package.json                      # dev, build (tsc -b && vite build), lint (oxlint), preview
├── tsconfig*.json, .oxlintrc.json
├── .env.example                      # frontend VITE_* variables (copy to .env.local)
├── public/                           # static assets (favicon)
├── src/                              # React frontend
├── backend/                          # FastAPI backend
├── developer-handoff/                # these docs
└── .github/workflows/ci.yml          # CI: lint + build, pytest with MongoDB
```

## Frontend (`src/`)

```
src/
├── main.tsx, App.tsx, index.css, vite-env.d.ts
├── routes/        AppRoutes.tsx, guards.tsx, navigation.ts
├── layouts/       AppLayout, AuthLayout, MarketingLayout, OnboardingLayout, Navbar, Sidebar, …
├── pages/         Dashboard, ProfilePage, ResumesPage, CreateResumePage, ResumeEditorPage, UploadResumePage,
│                  JobsPage, JobDetailPage, AIAssistantPage, AIMockInterviewPage, AccountPage, SettingsPage,
│                  PricingPage, Landing, About/HowItWorks/Guide/Contact, NotFound
│                  auth/ (Login, Signup, ForgotPassword), onboarding/ (Welcome, ImportResume, ImportLinkedIn,
│                  ManualSetup, Review), legal/ (Terms, Privacy, Cookie, Refund, AcceptableUse, AiDisclosure, Grievance)
├── components/    account, assistant, auth, brand, builder, dashboard, effects, jobs, landing, layout, legal,
│                  navigation, onboarding, profile, resumes, settings, transitions, ui, upgrade
├── services/      apiClient.ts + one *.service.ts per API area (auth, profile, resume, resumeDocument,
│                  resumeGeneration, resumeUpload, import, tailor, atsReview, jobAnalysis, job, applications,
│                  ai, assistant, interview, career, notifications, settings, subscription)
├── hooks/         useProfile, useResumes, useResumeEditor, useJobsView, useSavedJobs, useApplications, …
├── store/         Zustand: authStore, onboardingStore, savedJobsStore, applicationsStore, upgradeModalStore, …
├── lib/           firebase.ts (Firebase web SDK init)
├── types/         TypeScript contracts mirrored by backend/app/schemas
├── utils/         ATS heuristics, resume templates/printing, job filters, formatting helpers
├── mocks/         template previews and sample job descriptions (UI content, not API data)
├── assets/, styles/theme.css
```

## Backend (`backend/`)

```
backend/
├── requirements.txt          # pinned dependencies
├── .env.example              # copy to .env (git-ignored)
├── secrets/                  # service-account JSON files (git-ignored except .gitkeep)
├── tests/                    # pytest suite (conftest.py, helpers.py, test_*.py)
├── pytest.ini
├── requirements-dev.txt      # requirements.txt + pytest
└── app/
    ├── main.py               # app factory, lifespan (Firebase init, Mongo ping + indexes, seed, warnings),
    │                         # CORS, error handlers, /api router, /api/health, maintenance loop
    ├── api/
    │   ├── deps.py           # run_ai / ai_action (daily quota + refund), stored_profile
    │   ├── account.py        # /auth/sync, /auth/logout, /me…, sessions, export, delete
    │   ├── profile.py        # /profile
    │   ├── resumes.py        # /resumes…, generate, analyze-job, tailor, ATS analyze
    │   ├── files.py          # /files/upload, parse-resume, parse-profile
    │   ├── ai.py             # /ai/usage, transform, chat, interview sessions
    │   ├── jobs.py           # /jobs…, /jobs/search, /companies
    │   ├── applications.py   # /applications
    │   ├── notifications.py  # /notifications
    │   ├── support.py        # /contact, /feedback
    │   └── billing.py        # /subscriptions/*, /payments/*
    ├── core/
    │   ├── config.py         # Settings (pydantic-settings, reads backend/.env)
    │   ├── security.py       # Firebase init, get_current_user, Firebase user helpers
    │   ├── errors.py         # ApiError, error envelope, handlers, UnhandledErrorMiddleware
    │   ├── limiter.py        # slowapi limiter
    │   └── utils.py          # ok(), iso(), new_id(), utcnow()
    ├── db/mongo.py           # AsyncMongoClient, collection accessors, ensure_indexes()
    ├── schemas/              # common.py, profile.py, resume.py, settings.py
    ├── services/
    │   ├── ai_client.py      # AI SDK client, structured output, retries
    │   ├── ai_tasks.py       # prompts + anti-fabrication guards for every AI feature
    │   ├── accounts.py       # user documents, public_user, usage counters
    │   ├── sessions.py       # device sessions / SESSION_REVOKED
    │   ├── quota.py          # plans, entitlements, resume credits, daily AI allowance
    │   ├── free_resume_guard.py
    │   ├── resumes.py        # resume persistence, summary/document views
    │   ├── resume_logic.py   # profile → resume mapping, patches, keyword helpers
    │   ├── ats.py            # heuristic ATS score
    │   ├── documents.py      # file type detection, PDF/DOCX text extraction
    │   ├── storage.py        # bucket or MongoDB upload storage, cleanup
    │   ├── apify_jobs.py     # live job search via Apify actors
    │   ├── job_ingest.py     # job feed: fetch, AI structuring, expiry, match notifications
    │   ├── job_matching.py   # per-user match percent, recommendations
    │   ├── notifications.py  # in-app notifications + email copies
    │   └── email.py          # SMTP sender
    ├── cli/ingest_jobs.py    # one ingestion pass for cron
    └── seed/                 # __init__.py (seed_demo_jobs), jobs_seed.json
```
