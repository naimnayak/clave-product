# 04 · Authentication & Security

## Sign-in flow

1. The frontend signs the user in with the Firebase JS SDK (`src/lib/firebase.ts`, `auth.service.ts`): email/password or federated providers enabled in the Firebase project.
2. Every API call (`src/services/apiClient.ts`) sends `Authorization: Bearer <Firebase ID token>` and `X-Clave-Session: <per-browser random id>`.
3. After each sign-in or sign-up the app calls `POST /api/auth/sync`, which creates or refreshes the `users` document.
4. Password changes, resets and email verification happen in Firebase. The backend only records a notice (`POST /api/me/security/password-changed`).

There are no backend-issued JWTs, passwords or refresh tokens. Clave does not store credentials.

## Token verification (`app/core/security.py`)

- `init_firebase()` loads the service account from `FIREBASE_SERVICE_ACCOUNT` (default `secrets/firebase-service-account.json`) at startup. The server refuses to start if the file is missing.
- `get_current_user` verifies the ID token with `firebase_admin.auth.verify_id_token` (10 s clock skew) in a worker thread and returns `CurrentUser(uid, email, name, picture, email_verified, provider)`.
- Errors: missing/invalid token → `401 UNAUTHENTICATED`; expired → `401 TOKEN_EXPIRED` (the client force-refreshes the token and retries once); Firebase public keys unreachable → `503 SERVICE_UNAVAILABLE`.
- Any other `401` makes the client sign the user out.

## Device sessions (`app/services/sessions.py`)

Firebase does not expose sessions, so Clave tracks them:
- The browser keeps a random id in `localStorage` (`clave.session-id`), rotated on every sign-in and sign-out.
- On each authenticated request, `check_and_touch` validates the id (16-64 chars, `[A-Za-z0-9-]`), creates a `sessions` document on first sight (device label parsed from the User-Agent), and updates `lastActiveAt` at most every 5 minutes. Sessions expire 60 days after last activity (TTL).
- A revoked session returns `401 SESSION_REVOKED` on every call from that browser, which signs it out.
- Endpoints: `GET /api/me/security` (list), `DELETE /api/me/sessions/{id}`, `POST /api/me/sessions/revoke-others`, `POST /api/auth/logout`.
- Requests without the header still authenticate; they just aren't tracked as a session.

## Authorization

Single role (end user). Every user-owned query filters on the Firebase `uid`; accessing someone else's resource returns `404 RESOURCE_NOT_FOUND`, never `403`. There is no admin API.

## Transport & CORS (`app/main.py`)

- CORS origins from `ALLOWED_ORIGINS`; methods GET/POST/PUT/PATCH/DELETE/OPTIONS; headers `Authorization`, `Content-Type`, `X-Clave-Session`; `Content-Disposition` exposed; `allow_credentials=False` (no cookies).
- `/api/docs` and `/api/openapi.json` are disabled when `APP_ENV=production`.
- Run behind HTTPS in production (see 12).

## Rate limiting (`app/core/limiter.py`)

slowapi, keyed by `uid:<uid>` when signed in, otherwise `ip:<address>`. Counters live in `RATE_LIMIT_STORAGE_URI` (`memory://` for one process; use `redis://…` with several workers).

| Scope | Limit |
|---|---|
| AI endpoints (`[AI]` in 02) | `AI_RATE_LIMIT` (default `30/minute`) |
| `GET /jobs/search` | `10/minute` |
| `POST /contact` | `5/hour` |
| `POST /feedback` | `20/hour` |

Separately, daily AI allowances per plan return `429 AI_DAILY_LIMIT_REACHED` (see 05).

## Input handling

- All bodies are Pydantic models with length limits (see 03); unknown fields are ignored.
- Uploads are identified by magic bytes, capped at `MAX_UPLOAD_BYTES`, and file names are sanitized (see 06).
- Avatars accept only image data URLs (≤ 400k chars) or `https://` URLs.
- Prompts treat job descriptions and resumes as untrusted data and tell the AI model to ignore instructions inside them (see 05).
- The contact form has a honeypot field.
- Unhandled exceptions are logged and returned as a generic `500 INTERNAL_ERROR` without stack traces.

## Payments

`POST /api/payments/verify` checks the Razorpay HMAC-SHA256 signature with `hmac.compare_digest`. The plan comes from the order stored at creation time, never from the client. An order is marked paid with an atomic `status: "created" → "paid"` update, so a plan is granted once per order; `paymentId` is unique. Webhook: Not implemented yet.

## Abuse controls

- Free resume limit uses a lifetime counter (deleting resumes does not reset it).
- Optional free-resume guard (`FREE_RESUME_GUARD_ENABLED`, off by default) stores salted SHA-256 hashes of IP and a header fingerprint and blocks a second free resume from the same network/device.

## Secrets

- Service-account JSON files go in `backend/secrets/` (git-ignored). Never commit `backend/.env`, `.env.local` or anything in `secrets/`.
- The frontend only receives the Firebase web config (`VITE_FIREBASE_*`) and, for checkout, the public Razorpay key id.

## Privacy

- `GET /api/me/export` returns all stored data as JSON.
- `DELETE /api/me` deletes user data and the Firebase login (payments are retained for accounting).
- The assistant uses the Career Profile only when Settings → Privacy → Personalize AI is on.
