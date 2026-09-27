# 13 · Admin Panel

`/admin` in the web app (`src/admin/`, lazy-loaded) backed by `/api/admin/*` (`backend/app/api/admin.py`).

## Access

| Role | How | Can |
|---|---|---|
| Owner | Verified email listed in `ADMIN_EMAILS` | Everything. Can't be demoted, suspended or deleted from the panel. |
| Admin | `users.role = "admin"`, set by an owner/admin | Everything |
| Support | `users.role = "support"` | Read users, payments, plans, jobs, metrics and the audit log; support inbox; internal notes |

Roles are checked on every request (`services/admin.py`). Users can't set their own role through any
user endpoint. Staff accounts need a verified email. Nobody can change their own account or an owner's
from the panel. Every change is written to `admin_audit` (who, what, before/after, reason, IP).

## Sections

- **Overview:** users, active/active-this-week, Pro subscribers and expiries, revenue (month / all time / refunds), 30-day sign-up and revenue charts, AI and chat usage today, Apify listings and estimated cost vs the monthly cap, open support messages.
- **Users / Subscribers:** search (name, email, uid), filters (plan, status, role), sort, CSV export (admins, audited). User page:
  - give / extend / end Pro (marked "comped"), add or remove resume credits
  - reset resume count, mock interviews, today's AI usage or free-resume device claims
  - suspend (signs out every device; API returns 401 `ACCOUNT_SUSPENDED`) / reactivate
  - change role, send a notification, run a job-feed search now, internal notes, admin history
  - delete the account (type the email to confirm; payments are kept)
- **Plans & pricing:** name, description, price, Pro period, limits (empty = unlimited), features, availability. Saved to the `plans` collection and live immediately.
- **Payments:** all Razorpay orders with search and filters; refunds (full or partial) through the Razorpay API, optionally taking back the Pro days or credit.
- **Jobs & feed:** listings by source, latest listings (hide/show spam), Apify usage vs cap, per-user feed limits.
- **Support inbox:** contact-form messages (reply by email, resolve/reopen) and in-app feedback.
- **Broadcast:** in-app announcement to everyone, Pro or Free users (respects "Product updates" setting; no email).
- **Audit log:** filter by action or target.

Feed and Apify limits are environment settings (`JOB_FEED_*`, `APIFY_*`), shown read-only in the panel.
