# 01 · Database Schema (MongoDB)

Database name: `MONGO_DB_NAME` (default `clave`). Access goes through `app/db/mongo.py` (PyMongo `AsyncMongoClient`, `tz_aware=True`, 5 s server selection timeout). Indexes are created on startup by `ensure_indexes()`.

Conventions:
- The Firebase `uid` is the owner key. User-owned documents store `uid` (or use it as `_id`), and every query filters on it.
- Field names are camelCase to match the frontend types. Dates are stored as UTC `datetime` and returned as ISO 8601 with `Z`.
- IDs are prefixed UUID hex strings created by `new_id()` (for example `res_…`, `file_…`).

## Collections

### users
`_id` = Firebase uid. Created or refreshed by `POST /api/auth/sync` (`services/accounts.py`).

| Field | Notes |
|---|---|
| name, email, emailVerified, provider, avatarUrl | Identity (avatar is an https URL or an image data URL) |
| onboardingComplete | bool |
| settings | `UserSettings` (see 03) |
| subscription | `{plan: "free"\|"monthly", status, currentPeriodEnd, singleResumesBalance}` |
| usage | Counters: `resumesCreated` (lifetime, drives the free limit), `aiGenerations`, `tailorings`, `atsAnalyses`, `parses`, `uploadsSaved` |
| createdAt, updatedAt, lastLoginAt | |

### profiles
`_id` = uid. `{data: ProfileData, createdAt, updatedAt}`. The Career Profile.

### resumes
`{_id: "res_…", uid, name, targetRole, template, sectionOrder, content, atsScore, type: "base"|"tailored", sourceType, sourceResumeId, tailoredFor, status: "draft"|null, lastAtsAnalysis, createdAt, updatedAt}`
Index: `(uid, updatedAt desc)`.

### files (uploads)
`{_id: "file_…", uid, fileName, fileType: "pdf"|"docx", fileSize, storage: "mongo"|"bucket", data (Binary, mongo only), objectName (bucket only), text, resumeId, createdAt}`
Indexes: `uid`; TTL on `createdAt` = `UPLOAD_RETENTION_DAYS` (default 7 days). `resumeId` is set once an upload is saved as a resume.

### jobs
`{_id, externalId, title, company, location, city, workType, level, roleType, experience, skills, salary, applyUrl, detail: {jobType, about, responsibilities, requirements, niceToHave, stretchSkill}, source: "seed"|"apify:<source>", active, postedAt, ingestedAt, lastSeenAt}`
Indexes: `externalId` unique sparse; `(active, postedAt desc)`. Match percent is computed per user at read time, not stored.

### companies
`_id` = company name; company profile fields from the seed file.

### saved_jobs
`{uid, jobId, savedAt}`. Unique index `(uid, jobId)`.

### applications
`{uid, jobId, status: "applied"|"interviewing"|"rejected", title, company, notes, appliedAt, updatedAt}`. Unique index `(uid, jobId)`.

### interview_sessions
`{_id: "int_…", uid, role, level, focusSkills, totalQuestions, questions[], answers[{questionIndex, question, answer, evaluation}], createdAt, updatedAt}`. Index `(uid, createdAt desc)`.

### notifications
`{_id: "ntf_…", uid, category: jobs|resumes|applications|product|account, title, body, link, read, createdAt, expireAt}`
Indexes: `(uid, createdAt desc)`; TTL on `expireAt` (set to `NOTIFICATION_RETENTION_DAYS`, default 90).

### sessions
`_id` = `"<uid>:<sid>"`. `{uid, sid, device, createdAt, lastActiveAt, revoked, expireAt}`
Indexes: `(uid, lastActiveAt desc)`; TTL on `expireAt` (60 days after last activity).

### ai_usage
`_id` = `"<uid>:<YYYY-MM-DD>"` (UTC day). `{uid, count, expireAt}`. TTL on `expireAt` (2 days).

### payments
`_id` = Razorpay order id. `{uid, plan: "single"|"monthly", amount (paise), currency: "INR", status: "created"|"paid", paymentId, paidAt, createdAt}`
Indexes: `uid`; `paymentId` unique sparse. Kept when an account is deleted (accounting).

### job_search_cache
`_id` = `"query|location|limit|sources"`. `{result, createdAt}`. TTL on `createdAt` = 6 hours.

### free_resume_claims
`{uid, ipHash, fingerprintHash, claimedAt}` (salted SHA-256 hashes only). Indexes: `uid`, `ipHash`, `fingerprintHash` sparse. Used only when `FREE_RESUME_GUARD_ENABLED=true`.

### contact_messages
`{_id: "msg_…", name, email, topic, message, status: "new", emailed, createdAt}`. No uid (public form).

### feedback
`{_id: "fb_…", uid, email, message, page, rating, createdAt}`.

### ingest_runs
Job-feed run summaries, plus a `{_id: "lease", until}` document that ensures only one ingestion runs at a time (30-minute lease).

## TTL summary

| Collection | Field | Lifetime |
|---|---|---|
| files | createdAt | `UPLOAD_RETENTION_DAYS` (7 days) |
| notifications | expireAt | `NOTIFICATION_RETENTION_DAYS` (90 days) |
| sessions | expireAt | 60 days after last activity |
| ai_usage | expireAt | 2 days |
| job_search_cache | createdAt | 6 hours |

Bucket objects for uploads are not covered by the TTL; `storage.cleanup_expired()` removes them (see 06).

## Account deletion

`DELETE /api/me` removes the user's documents from resumes, profiles, files (and bucket objects), saved_jobs, applications, notifications, sessions, ai_usage, feedback, interview_sessions, free_resume_claims and users, then deletes the Firebase user. `payments` are retained.
