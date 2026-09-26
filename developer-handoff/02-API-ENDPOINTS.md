# 02 · API Endpoints

Base path: `/api` (routers mounted in `app/main.py`). JSON bodies and responses use camelCase. OpenAPI UI: `/api/docs` (disabled when `APP_ENV=production`).

## Conventions

**Auth.** "User" means `Authorization: Bearer <Firebase ID token>` is required (`get_current_user`). The web app also sends `X-Clave-Session: <random id>` so device sessions can be listed and revoked (see 04). "Public" endpoints need no token.

**Success envelope** (`core/utils.py` `ok()`):
```json
{ "data": <payload>, "message": "optional human message" }
```
`204` responses have no body. `GET /me/export` returns a raw JSON file.

**Error envelope** (`core/errors.py`):
```json
{ "error": { "code": "PLAN_LIMIT_REACHED", "message": "…", "details": null, "...extra": "…" } }
```
Validation errors put `[{ "field", "message" }]` in `details`. Unexpected exceptions return a sanitized `500 INTERNAL_ERROR`.

**Markers.** `[AI]` = counts as one daily AI action (refunded if the AI call fails) and is rate limited per user by `AI_RATE_LIMIT` (default `30/minute`). `[Credit]` = consumes a resume credit (see 07).

## Error codes

| Status | Code | When |
|---|---|---|
| 400 | BAD_REQUEST | Generic bad request (for example revoking the current session) |
| 400 | FILE_TOO_LARGE / EMPTY_FILE / UNSUPPORTED_FILE_TYPE / UNREADABLE_FILE | Upload problems (see 06) |
| 400 | PAYMENT_VERIFICATION_FAILED | Razorpay signature mismatch |
| 401 | UNAUTHENTICATED | Missing or invalid ID token |
| 401 | TOKEN_EXPIRED | Expired ID token (the client refreshes once and retries) |
| 401 | SESSION_REVOKED | This browser's session was signed out from another device |
| 402 | PLAN_LIMIT_REACHED | No resume allowance left. Error object also carries `plans` (single, monthly) |
| 404 | RESOURCE_NOT_FOUND | Missing, or owned by another user |
| 405 | METHOD_NOT_ALLOWED | |
| 409 | CONFLICT | Upload already saved, interview already complete, payment already used |
| 422 | VALIDATION_ERROR | Body/query validation failed |
| 429 | RATE_LIMIT_EXCEEDED | slowapi burst limit hit |
| 429 | AI_DAILY_LIMIT_REACHED | Daily AI allowance used up (resets at midnight UTC) |
| 500 | INTERNAL_ERROR | Unhandled error |
| 502 | AI_GENERATION_FAILED | AI returned unusable output or rejected the request |
| 502 | PAYMENT_GATEWAY_ERROR / UPSTREAM_ERROR | Razorpay or Apify failed |
| 503 | AI_GENERATION_FAILED | AI not configured, busy or unreachable |
| 503 | PAYMENTS_NOT_CONFIGURED | Razorpay keys not set |
| 503 | SERVICE_UNAVAILABLE | Firebase keys unreachable, live job search not configured |

## System

| Method | Path | Auth | Response `data` |
|---|---|---|---|
| GET | /health | Public | `{status: "ok"\|"degraded", database: "ok"\|"unavailable", ai: "configured"\|"off"}` |

## Account (`api/account.py`)

| Method | Path | Auth | Request | Response `data` / notes |
|---|---|---|---|---|
| POST | /auth/sync | User | `{name?}` (optional body) | `{user, onboardingComplete, isNewUser}`. Call after every Firebase sign-in/sign-up. Creates the user on first call. |
| POST | /auth/logout | User | none | `{loggedOut: true}`; revokes the current session |
| GET | /me | User | | `PublicUser` `{id, name, email, avatarUrl, emailVerified, provider, onboardingComplete, isActive, createdAt, updatedAt}` |
| PUT | /me | User | `{name?, avatarUrl?}` | `PublicUser`. Avatar must be an image data URL (png/jpeg/webp/gif, ≤ 400k chars) or `https://` URL; `null`/`""` clears it. |
| POST | /me/onboarding | User | | `{onboardingComplete: true}` |
| GET | /me/settings | User | | `UserSettings` |
| PUT | /me/settings | User | `UserSettings` | `UserSettings` |
| GET | /me/security | User | | `{providers[], passwordUpdatedAt, emailVerified, sessions[{id, device, lastActive, createdAt, current}]}` |
| POST | /me/security/password-changed | User | | `{notified: true}`. Records a security notification; the password itself changes in Firebase. |
| DELETE | /me/sessions/{sessionId} | User | | 204. `400 BAD_REQUEST` for the current session. |
| POST | /me/sessions/revoke-others | User | | `{revoked: n}` |
| GET | /me/export | User | | JSON file download (`Content-Disposition: attachment`) with account, profile, resumes, jobs, applications, interviews, notifications, uploads metadata, payments, feedback, sessions |
| DELETE | /me | User | | 204. Deletes all user data (payments kept) and the Firebase user |

## Career Profile (`api/profile.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | /profile | User | | `ProfileData` or `null` |
| PUT | /profile | User | `ProfileData` | `ProfileData` (missing entry ids are generated) |

## Resumes (`api/resumes.py`)

| Method | Path | Auth | Request | Response `data` / notes |
|---|---|---|---|---|
| GET | /resumes | User | | `ResumeSummary[]` sorted by `updatedAt` desc |
| POST | /resumes | User | `ResumeCreate` | `ResumeDocument` (201). `[Credit]` unless `sourceType="upload"`, which needs `sourceFileId` and is free once per upload (409 if reused). |
| POST | /resumes/analyze-job | User | `{targetRole, jobDescription?, careerProfile?}` | `[AI]` `{role, company, location, workType, experience, alignmentScore, keyRequirements[], matchedSkills[], gaps[], insights[{type, title, body}]}`. Stored profile wins over `careerProfile`. |
| POST | /resumes/generate | User | `{targetRole, industry?, jobDescription?, attempt (0-20), template?, jobAnalysis?{keyRequirements, matchedSkills, gaps}}` | `[AI]` `{doc: ResumeDocument (unsaved draft), keywords[], usedJobDescription}`. Pre-checks allowance (402) but does not consume a credit; saving via `POST /resumes` does. |
| GET | /resumes/{id} | User | | `ResumeDocument` |
| PUT | /resumes/{id} | User | `ResumeDocumentIn` | `ResumeSummary`; ATS score recomputed |
| PATCH | /resumes/{id} | User | `ResumePatch` `{name?, targetRole?, template?, status?}` | `ResumeSummary`. `status: "ready"` clears the draft flag. |
| DELETE | /resumes/{id} | User | | 204 |
| POST | /resumes/{id}/duplicate | User | | `ResumeDocument` (201). `[Credit]` |
| POST | /resumes/{id}/tailor/analyze | User | `{jobTitle?, company?, jobDescription}` | `[AI]` `{jobTitle, company, keywords{matched, missing, all}, changes[{id, title, description, patch}]}`. Nothing saved. |
| POST | /resumes/{id}/tailor | User | same | `[AI]` `[Credit]` new tailored `ResumeDocument` + `analysis` (201). Applies all changes except `addSkills`. |
| POST | /resumes/{id}/analyze | User | `{jobDescription?}` | `[AI]` `{score, summary, factors{keywordMatch, skillsMatch, experienceMatch, formatting, sectionCompleteness}, missingKeywords[], suggestions[], heuristic}`. Saved as `lastAtsAnalysis`. |

Patch ops returned by tailoring: `setTargetRole`, `setSummary`, `addSkills`, `moveProjectToTop`, `replaceBullet`.

## Files (`api/files.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | /files/upload | User | multipart `file` (PDF/DOCX, ≤ 10 MB) | `{fileId, fileName, fileSize, fileType, status: "ready"}` (201). Not an AI action. |
| POST | /files/{fileId}/parse-resume | User | | `[AI]` `{fileId, targetRole, name, document: ResumeDocument, atsScore}`. Nothing saved. |
| POST | /files/{fileId}/parse-profile | User | | `[AI]` `ProfileData` draft. Does not overwrite the saved profile. |
| DELETE | /files/{fileId} | User | | 204 |

## AI (`api/ai.py`, prefix `/ai`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | /ai/usage | User | | `{limit, used}` for today (UTC) |
| POST | /ai/transform | User | `{text, action: improve\|rewrite\|concise\|impact, context{role, skills[], kind?: "summary"}}` | `[AI]` `{text}` |
| POST | /ai/chat | User | `{message, context?, history[≤20]{role: user\|assistant, content}}` | `[AI]` `{reply, suggestedActions[], personalized}`. Uses the profile only when `settings.privacy.personalizeAi` is on. |
| GET | /ai/interview/sessions | User | query `limit` 1-50 (10) | Session summaries (no questions/answers) |
| POST | /ai/interview/sessions | User | `{role, level="mid", focusSkills[], totalQuestions 1-15 (5)}` | `[AI]` Session (201) with the first question |
| POST | /ai/interview/sessions/{id}/answers | User | `{answer}` | `[AI]` Session + `evaluation{score, summary, whatWorked[], improvementPoints[]}`. Evaluation + next question = one action. 409 when complete. |
| GET | /ai/interview/sessions/{id} | User | | Session |
| DELETE | /ai/interview/sessions/{id} | User | | 204 |

Session shape: `{sessionId, role, level, focusSkills, totalQuestions, questionIndex, answeredCount, completed, overallScore, createdAt, updatedAt, questions[{question, category, difficulty, expectedKeyPoints}], answers[]}`.

## Jobs (`api/jobs.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | /jobs | User | query `q` (≤200), `workType` remote\|hybrid\|onsite, `level` internship\|entry\|junior\|mid, `page` (1), `limit` 1-100 (50) | `Job[]` newest first: `{id, title, company, location, experience, matchPercent, skills, city, workType, level, roleType, postedDaysAgo, salary?, applyUrl?, recommended}` |
| GET | /jobs/recommended | User | query `limit` 1-20 (3) | Top recommended `Job[]` by match |
| GET | /jobs/details | User | | `{jobId: {jobType, about, responsibilities, requirements, niceToHave, stretchSkill}}` |
| GET | /jobs/saved | User | | `{jobId: savedAt}` |
| GET | /jobs/search | User | query `q` (2-120), `location`, `limit` 1-30 (12), `sources` (`indeed,naukri`) | Raw live listings from Apify: `{jobs[], count, sources_requested, sources_used, sources_skipped, source_errors, source_counts, sources_no_results}`. Cached 6 h. Limit `10/minute`. 503 without `APIFY_API_TOKEN`, 502 `UPSTREAM_ERROR` on failure. |
| GET | /jobs/{id} | User | | `{job, detail, company}` |
| POST | /jobs/{id}/save | User | | `{jobId, savedAt}` (idempotent) |
| DELETE | /jobs/{id}/save | User | | 204 |
| GET | /companies | User | | `{companyName: {...profile}}` |

## Applications (`api/applications.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | /applications | User | | `[{jobId, status, title, company, notes, appliedAt, updatedAt}]` |
| PUT | /applications/{jobId} | User | `{status: applied\|interviewing\|rejected, notes?}` | Application (upsert; notifies on status change) |
| DELETE | /applications/{jobId} | User | | 204 |

## Notifications (`api/notifications.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | /notifications | User | query `limit` 1-100 (30) | `{items[{id, category, title, body, link, read, createdAt}], unreadCount}` |
| POST | /notifications/read | User | `{ids[≤100]}` (empty = all) | `{unreadCount}` |

## Support (`api/support.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| POST | /contact | Public, `5/hour` per IP | `{name, email, topic?, message (10-5000), website}` (`website` is a honeypot) | `{received: true}` (201). Stored; emailed to `SUPPORT_INBOX` when SMTP is set. |
| POST | /feedback | User, `20/hour` | `{message (3-5000), page?, rating? 1-5}` | `{received: true}` (201) |

## Subscriptions & payments (`api/billing.py`)

| Method | Path | Auth | Request | Response `data` |
|---|---|---|---|---|
| GET | /subscriptions/plans | Public | | `{free, single, monthly}` each `{name, price, currency, description}` |
| GET | /subscriptions/current | User | | Entitlements `{plan, status, currentPeriodEnd, resumesCreated, resumesAllowance, singleResumesBalance, isUnlimited, canCreateResume, limitsEnforced}` |
| POST | /payments/orders | User | `{plan: single\|monthly}` | `{orderId, amount (paise), currency, keyId, plan}` (201). 503 `PAYMENTS_NOT_CONFIGURED`, 502 `PAYMENT_GATEWAY_ERROR`. |
| POST | /payments/verify | User | `{razorpayOrderId, razorpayPaymentId, razorpaySignature}` | Updated entitlements. 400 `PAYMENT_VERIFICATION_FAILED`, 404 unknown order, 409 payment reused. Granting is idempotent per order. |
| POST | /payments/webhook | | | Not implemented yet |

The frontend does not call the payment endpoints yet (checkout UI: Not implemented yet).
