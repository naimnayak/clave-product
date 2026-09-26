# 07 · Subscriptions & Usage

Code: `app/services/quota.py`, `app/api/billing.py`, `app/services/resumes.py`. Frontend: `src/services/subscription.service.ts`, upgrade modal opened automatically on `PLAN_LIMIT_REACHED` (`apiClient.ts`).

## Plans

| Plan | Price | What you get |
|---|---|---|
| Free | ₹0 | `FREE_RESUME_LIMIT` = 1 resume, lifetime |
| Single Resume | `SINGLE_RESUME_PRICE_INR` = ₹49 | +1 resume credit per purchase (`subscription.singleResumesBalance`) |
| Monthly Unlimited | `MONTHLY_PRICE_INR` = ₹199 | Unlimited resumes for `MONTHLY_PLAN_DAYS` = 30 days. One-time payment, no auto-renew. Buying again extends from the current end date. |

Daily AI allowance: `AI_DAILY_LIMIT_FREE` = 30, `AI_DAILY_LIMIT_PAID` = 300 while Monthly is active (see 05). Single Resume credits do not raise the AI allowance.

## What consumes a resume credit

| Action | Credit |
|---|---|
| `POST /resumes` (manual, template, AI draft) | Yes |
| `POST /resumes` with `sourceType: "upload"` | No (once per uploaded file) |
| `POST /resumes/{id}/duplicate` | Yes |
| `POST /resumes/{id}/tailor` (creates a new resume) | Yes |
| `POST /resumes/generate` | No, but it pre-checks the allowance (402) so AI isn't spent on something that can't be saved |
| Uploading, parsing, editing, ATS analysis, tailor analysis | No |

## Consumption order (`consume_resume_credit`)

Atomic `find_one_and_update` steps, first match wins:
1. `ENFORCE_PLAN_LIMITS=false` → just count (development only).
2. Active Monthly plan → count.
3. Free allowance left (`usage.resumesCreated < FREE_RESUME_LIMIT`) and the optional free-resume guard doesn't block → count.
4. `singleResumesBalance > 0` → count and decrement the balance.
5. Otherwise `402 PLAN_LIMIT_REACHED`, with `plans` (single, monthly) in the error object.

`usage.resumesCreated` is a lifetime counter, so deleting resumes doesn't restore the free allowance.

## Entitlements (`GET /api/subscriptions/current`)

```json
{ "plan": "free|monthly", "status": "active|expired", "currentPeriodEnd": "…Z|null",
  "resumesCreated": 1, "resumesAllowance": 1, "singleResumesBalance": 0,
  "isUnlimited": false, "canCreateResume": false, "limitsEnforced": true }
```
`plan` reports `monthly` only while `currentPeriodEnd` is in the future; an elapsed Monthly plan reports `free` with `status: "expired"`.

## Payments (Razorpay, `api/billing.py`)

1. `POST /api/payments/orders {plan}` creates a Razorpay order in INR (amount in paise) and stores it in `payments` with `status: "created"`. Returns `orderId`, `amount`, `currency`, `keyId`.
2. The client opens Razorpay Checkout with those values. **Not implemented yet** in the frontend.
3. `POST /api/payments/verify {razorpayOrderId, razorpayPaymentId, razorpaySignature}` verifies the HMAC signature, atomically marks the order paid, and grants the plan stored on the order (single: +1 credit; monthly: extend `currentPeriodEnd` by 30 days). Repeat verifications return entitlements without granting again.

Without `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` the payment endpoints return `503 PAYMENTS_NOT_CONFIGURED`.

Not implemented yet: Razorpay webhook (payments captured but never verified by the client are not reconciled automatically), refunds API, invoices.

## ENFORCE_PLAN_LIMITS

Default `true`. Setting it to `false` disables resume quotas (`canCreateResume` always true, startup logs a warning). Use only in development; keep `true` in production. It does not disable the daily AI allowance.
