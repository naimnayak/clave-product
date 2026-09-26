# 11 · Seed & Mock Data

## Demo job catalog

- File: `backend/app/seed/jobs_seed.json` with `jobs` (list) and `companies` (name → profile). It was converted from the original frontend job mocks.
- Loader: `seed_demo_jobs()` in `backend/app/seed/__init__.py`, called at startup when `SEED_DEMO_JOBS=true` (default).
- It runs only when the `jobs` collection is empty. Each job is inserted with `_id` from its `id`, `postedAt = now − postedDaysAgo`, `source: "seed"`, `active: true`; any `matchPercent` in the file is dropped (match is computed per user). The `companies` collection is replaced with the seed companies.

## Demo jobs retire automatically

After a job-feed run, if any active job with `source != "seed"` exists, all seed jobs are set to `active: false`. Only active jobs are listed, so real listings replace the demo catalog without manual cleanup.

## Job feed (real jobs)

`app/services/job_ingest.py`, run once with:

```bash
cd backend && .venv/bin/python -m app.cli.ingest_jobs
```

Prints a JSON summary; exits 1 only if there were errors and nothing was created or refreshed. It also runs `storage.cleanup_expired()`.

One pass:
1. Requires `APIFY_API_TOKEN` and a configured AI model; takes a 30-minute lease in `ingest_runs` so only one process ingests at a time.
2. Queries = `JOB_INGEST_QUERIES`, or the most common `targetRoles` across Career Profiles, or built-in defaults; capped by `JOB_INGEST_MAX_QUERIES`.
3. Fetches listings via Apify actors (`apify_jobs.search_jobs_parallel`) for `JOB_INGEST_SOURCES` in `JOB_INGEST_LOCATION`.
4. Already-known listings (by `externalId`, a hash of URL or source/title/company) just get `lastSeenAt` refreshed.
5. New listings are structured by the AI model (lite) in batches of 5: non-job pages dropped, work type, level, role family, skills and detail sections extracted using only what the listing says.
6. Feed jobs not seen for `JOB_MAX_AGE_DAYS` are deactivated; seed jobs retire as above.
7. Users whose profile matches new jobs at ≥ `JOB_MATCH_NOTIFY_THRESHOLD` get a `jobs` notification.
8. The summary is stored in `ingest_runs`.

Scheduling: cron (for example every 12 hours), or set `JOB_INGEST_INTERVAL_HOURS > 0` to run inside the API process (see 12).

## Live search

`GET /api/jobs/search` returns raw Apify listings (not stored as jobs), cached for 6 hours in `job_search_cache`.

## Frontend mocks

`src/mocks/` now only holds UI content (resume template previews, templates, sample job descriptions). App data comes from the API.

## Local test data

There is no user/resume seed. Create data by signing up in the app, or through the API with a Firebase ID token.
