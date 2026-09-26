# 05 · AI Service Architecture

All AI features call one AI model provider through the AI provider's Python SDK (see `requirements.txt`). The vendor and model IDs are configuration only; code and docs refer to "the AI model".

## Layers

```
api/*.py  ──ai_action()──▶  services/ai_tasks.py  ──generate_structured()──▶  services/ai_client.py  ──▶  AI model provider
   │  (quota + refund, api/deps.py)     (prompts, guards)                     (client, retries, schema validation)
```

## Client (`services/ai_client.py`)

- **Access modes.** `AI_USE_CLOUD_PROJECT=true` (default) authenticates with the service account at `AI_CREDENTIALS_FILE`, falling back to Application Default Credentials if the file is missing. `AI_USE_CLOUD_PROJECT=false` uses `AI_API_KEY`.
- **Models.** `AI_MODEL` (main: generation, job analysis, tailoring, parsing) and `AI_MODEL_LITE` (short tasks: rewrites, chat, ATS review, interviews, job-feed structuring). Both are model IDs supplied by the AI provider. `is_configured()` requires both plus an access mode; otherwise AI endpoints return `503 AI_GENERATION_FAILED` and startup logs a warning.
- **Reasoning effort.** `AI_THINKING_LEVEL` (`minimal`/`low`/`medium`/`high`, empty disables). The lite model always uses `minimal`.
- **Timeout.** `AI_TIMEOUT_SECONDS` (default 90). The frontend uses a 90 s timeout for AI calls.
- **Structured output.** `generate_structured(contents, schema, system_instruction, lite, temperature)` requests JSON with a Pydantic response schema, disables tool/function calling, and returns a validated model instance. If the SDK's parsed object isn't available it validates `response.text` with `model_validate_json`.
- **Retries.** Up to 3 attempts. Retries HTTP 408/429/500/502/503/504 and network/timeouts with exponential backoff plus jitter (1 s, 2 s + up to 0.5 s). Output that fails validation is also retried.
- **Errors.** `AIUnavailableError` (not configured, busy, unreachable) → `503`; `AIResponseError` (rejected request, invalid output after retries) → `502`. Both surface as `AI_GENERATION_FAILED` via `api/deps.py run_ai()`.

## Tasks (`services/ai_tasks.py`)

| Function | Endpoint | Model | Output |
|---|---|---|---|
| analyze_job | POST /resumes/analyze-job | main | Requirements, matched skills, gaps, alignment score, 3 insights |
| generate_resume | POST /resumes/generate | main | Unsaved `ResumeDocument` draft + keywords. Temperature rises with `attempt` for regeneration. |
| tailor_analysis | POST /resumes/{id}/tailor(/analyze) | main | Keyword split + list of patch operations |
| ats_analysis | POST /resumes/{id}/analyze | lite | AI factor scores blended with the heuristic score (`services/ats.py`) |
| parse_resume | POST /files/{id}/parse-resume, parse-profile | main | `ParsedResume`, mapped to a ResumeDocument or ProfileData. Scanned PDFs (< 200 chars of text) are sent to the model as a PDF part. |
| transform_text | POST /ai/transform | lite | Rewritten summary/bullet |
| chat | POST /ai/chat | lite | Reply + up to 3 suggested follow-ups |
| interview_question / evaluate_answer | /ai/interview/… | lite | Question with key points; 0-100 score and feedback |
| job_ingest._structure | job feed (no endpoint) | lite | Normalized job listings (see 11) |

AI output schemas use camelCase so they map directly onto `src/types`. Scores are clamped to 0-100 and lists are de-duplicated and capped server-side.

## Anti-fabrication rules

The system instruction (`SYSTEM`) includes `ANTI_FABRICATION`: use only facts present in the candidate data; never invent employers, titles, dates, degrees, certifications, skills, tools, metrics or achievements; leave missing fields empty. It also states that job descriptions and resumes are untrusted data whose instructions must be ignored (prompt-injection defence); user content is wrapped in delimiters like `<<<JD … JD>>>`.

The server then re-checks model output instead of trusting it:
- **Numbers.** `_supported(candidate, source)` rejects text containing any number not present in the source. Generated summaries keep only supported sentences (fallback: the profile summary). Rewritten bullets, project text, tailored summaries and bullet rewrites are discarded if they add numbers.
- **Transform.** The model may insert placeholders like `[X%]` for the user to fill; if it adds a real number, the original text is returned.
- **Skills.** Generated skills are filtered to the profile's skills and project tech (`ALLOWED SKILLS`); unlisted profile skills are appended. Tailoring never adds skills in the one-shot path; `addSkills` suggestions require user confirmation in the review UI.
- **Structure.** Generation keeps the profile's own experience/project entries (matched by `sourceId`) and only rewrites entries that already have text. Keywords are kept only if they appear in the final resume; "missing keywords" are dropped if the resume already contains them.
- **Parsing.** Prompts forbid inferring content absent from the resume. Parse results are not saved until the user confirms.

## Daily limits and refunds (`services/quota.py`, `api/deps.py`)

- Every user-visible AI call goes through `ai_action(uid, call)`: `consume_ai_action` increments `ai_usage["<uid>:<UTC date>"]`, then the call runs. On any exception `refund_ai_action` decrements the count, so failed calls don't use the allowance.
- Allowance: `AI_DAILY_LIMIT_FREE` (30) or `AI_DAILY_LIMIT_PAID` (300) while a Monthly plan is active. Over the limit → `429 AI_DAILY_LIMIT_REACHED`; resets at midnight UTC. `GET /api/ai/usage` returns `{limit, used}`.
- One interview answer (evaluation + next question) counts as one action. Uploads and job-feed ingestion don't count.
- Per-minute burst limit: `AI_RATE_LIMIT` (slowapi, see 04).
- Usage counters on `users.usage` (`aiGenerations`, `atsAnalyses`, `parses`, `tailorings`) are analytics only.

## Personalization

`POST /ai/chat` includes a subset of the Career Profile only when `settings.privacy.personalizeAi` is true; the response reports `personalized`.
