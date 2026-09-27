# 07 · Subscriptions & Usage

Server-side enforcement lives in `backend/app/services/quota.py`; the catalog in `services/plans.py`.

## Plans (`plans` collection)

| id | Name | Price | What it gives |
|---|---|---|---|
| `free` | Free | ₹0 | 5 resumes (lifetime, also capped per device), 15 AI actions/day, 10 assistant messages/day, 1 mock interview, a masked preview of the top 3 job matches |
| `single` | Single Resume | ₹49 one-time | +1 resume credit (never expires) |
| `monthly` | Clave Pro | ₹199 for 30 days, no auto-renewal | Unlimited resumes and mock interviews, 300 AI actions/day, 100 assistant messages/day, the personal job feed |

The documents are seeded from settings (`FREE_RESUME_LIMIT`, `AI_DAILY_LIMIT_*`, `CHAT_DAILY_LIMIT_*`, `FREE_MOCK_INTERVIEWS`, prices) the first time they are read. After that **MongoDB is the source of truth**: edit `db.plans` to change a price or limit (`null` = unlimited); changing the env vars does not touch existing documents. `GET /api/subscriptions/plans` returns the active plans.

The plan id `monthly` is kept for compatibility with stored subscriptions and payments; it is displayed as "Clave Pro".

## What counts as a resume

Every saved resume: manual, template, AI draft, duplicate, one-shot tailor and **uploads** (an uploaded file can be saved once). Unsaved AI drafts don't count; they use the daily AI allowance. Deleting a resume never gives the allowance back.

## Consumption order (`consume_resume_credit`)

1. `ENFORCE_PLAN_LIMITS=false`: count only.
2. Active Clave Pro: count.
3. Free allowance left **and** the device guard allows it: count and record a device claim.
4. Single-resume credit: count and decrement.
5. Otherwise 402 `PLAN_LIMIT_REACHED` (the frontend opens the upgrade modal).

`assert_can_create` runs the same checks (including the device guard) before AI generation and tailoring, so tokens aren't spent on something the user can't save.

## Device guard (`services/free_resume_guard.py`)

The frontend sends a random, persistent browser id in `X-Clave-Device`. Free resumes are capped at `FREE_RESUMES_PER_DEVICE` per device and per device + IP pair, never per IP alone, so other devices on the same network are unaffected. Only salted hashes are stored (`FREE_RESUME_GUARD_HASH_SALT`). The client IP comes from uvicorn's proxy headers; the edge nginx overwrites `X-Forwarded-For` so it can't be spoofed. Claims survive account deletion (detached from the uid) so re-creating an account doesn't reset a device.

## Pro-only features

- Jobs (`api/jobs.py`): every endpoint except `GET /jobs/preview` returns 402 `PRO_REQUIRED` for Free users. Apify cost controls are documented at the top of `services/job_feed.py`.
- Mock interviews: Free users can start `FREE_MOCK_INTERVIEWS` sessions, then 402 `PRO_REQUIRED`.
- Everything else (AI generation, tailoring, ATS analysis, rewrites, chat) is on every plan, limited by the daily allowances.

## Daily allowances (`ai_usage` collection)

One document per user per UTC day: `count` (AI actions) and `chat` (assistant messages) with separate caps. Failed AI calls are refunded. `GET /api/ai/usage` → `{limit, used, chatLimit, chatUsed, isPro}`.

## Entitlements (`GET /api/subscriptions/current`)

`plan` (`free` | `monthly`), `planName`, `isPro`, `status`, `currentPeriodEnd`, `resumesCreated`, `resumesAllowance`, `singleResumesBalance`, `isUnlimited`, `canCreateResume`, `limitsEnforced`, `limits`, `features`, `mockInterviewsUsed`.

## Payments (Razorpay, `api/billing.py`)

1. `POST /api/payments/orders {plan}` creates an order; the price comes from the plan document.
2. The frontend opens Razorpay Checkout (`src/services/payment.service.ts`).
3. `POST /api/payments/verify` checks the checkout signature and grants the plan.
4. `POST /api/payments/webhook` (Razorpay dashboard → Webhooks, events `payment.captured` and `order.paid`, secret in `RAZORPAY_WEBHOOK_SECRET`) grants it for payments whose browser closed early. It checks the amount against the stored order.

Granting is idempotent: whichever of verify/webhook arrives first flips the order from `created` to `paid`. Pro extends from the later of now and the current end date. Upgrading to Pro starts the user's first job feed search.

Not implemented: refunds and invoices (Razorpay emails receipts).

## ENFORCE_PLAN_LIMITS

Keep `true` in production. `false` disables resume, mock-interview and Pro checks (development only); the server logs a warning at startup.
