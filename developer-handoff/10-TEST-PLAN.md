# 10 · Test Plan

## Automated checks

| Check | Command | Where |
|---|---|---|
| Backend tests | `.venv/bin/pip install -r requirements-dev.txt` once, then `.venv/bin/pytest` (from `backend/`) | `backend/tests/` |
| Frontend lint | `npm run lint` (oxlint) | repo root |
| Frontend type check + build | `npm run build` (`tsc -b && vite build`) | repo root |
| CI | runs the above on push to main and on pull requests (MongoDB service container) | `.github/workflows/ci.yml` |

Backend tests need a running MongoDB (`MONGO_URL`) but no real Firebase, AI, Razorpay, Apify or SMTP access. `tests/conftest.py` sets test environment variables, replaces Firebase token verification with fake `test:<uid>` tokens (so session checks still run), and gives every test an empty `clave_test` database (override with `TEST_MONGO_DB_NAME`; it refuses to run against `clave`). AI calls are mocked per test by monkeypatching functions in `app.services.ai_tasks`.

Covered today (21 tests): health output, auth errors, sign-in sync and welcome notification, device sessions and revocation (`SESSION_REVOKED`), resume privacy between users, data export and account deletion, settings; Free / Single credit / Monthly allowance, upload exemption (once per file, owner only), Razorpay signature verification and idempotency, monthly period extension; AI daily limit (`AI_DAILY_LIMIT_REACHED`), refunds on 502/503, Personalize AI on/off, mock interview flow; application tracking, notifications read state, contact form honeypot and feedback.

## What the backend suite should cover

**Auth & sessions**
- Missing/invalid token → 401 `UNAUTHENTICATED`; expired → `TOKEN_EXPIRED`.
- Revoked `X-Clave-Session` → 401 `SESSION_REVOKED`; revoking the current session → 400.
- Cross-user access to resumes, files, interviews → 404.

**Envelope & validation**
- Success responses are `{data, message?}`; errors are `{error: {code, message, details}}`.
- Oversized fields and bad enums → 422 `VALIDATION_ERROR` with field details.

**Plans (07)**
- Free user: first resume succeeds, second → 402 `PLAN_LIMIT_REACHED` with `plans`.
- Deleting a resume doesn't restore the allowance.
- Single credit is decremented once; Monthly allows unlimited until `currentPeriodEnd`.
- Upload save is free, needs `sourceFileId`, and a second save of the same file → 409.
- `ENFORCE_PLAN_LIMITS=false` bypasses quotas.

**AI (05)**
- Daily limit → 429 `AI_DAILY_LIMIT_REACHED`; failed AI call refunds the action.
- AI not configured → 503 `AI_GENERATION_FAILED`; invalid output → 502.
- Anti-fabrication guards: invented numbers are rejected in generated summaries, bullets, tailoring and transforms; generated skills are limited to profile skills.

**Uploads (06)**
- PDF/DOCX accepted by magic bytes; renamed non-PDF/DOCX → `UNSUPPORTED_FILE_TYPE`; empty → `EMPTY_FILE`; > 10 MB → `FILE_TOO_LARGE`; unreadable → `UNREADABLE_FILE`.

**Payments**
- Verify with bad signature → 400; verify twice grants once; plan comes from the stored order; no keys → 503.

**Jobs**
- Filters, pagination, recommendations; save is idempotent; demo jobs retire once real jobs exist.

**Account**
- Export contains all collections; delete removes user data but keeps payments.

## Manual smoke test

1. Sign up, complete onboarding (upload a resume → parse-profile → review → save profile).
2. Generate a resume, save it, edit, change template, run ATS analysis.
3. Tailor it to a job description; confirm a new tailored resume appears and the original is unchanged.
4. Try a second non-upload resume on Free → upgrade modal.
5. Jobs: filter, save, mark applied; check notifications.
6. Assistant chat and a mock interview.
7. Account: list sessions, sign out another browser (it should be signed out on its next call), export data, delete account.
