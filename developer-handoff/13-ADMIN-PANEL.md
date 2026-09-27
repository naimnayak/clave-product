# 13 · Admin Panel

Served at **https://admin.atelierdevs.tech** (`src/admin/`, lazy-loaded) and backed by `/api/admin/*` (`backend/app/api/admin.py`).

- The same web image serves both hosts. On the admin host (`VITE_ADMIN_HOST`, set by docker-compose) the app shows only sign-in and the panel; `/admin` on the main site redirects there. Locally, without `VITE_ADMIN_HOST`, the panel is at `/admin`.
- With `ADMIN_HOST` set, the backend returns 404 for `/api/admin/*` on any other host, before authentication.
- Signing in on the admin host is separate from the main site (browsers keep logins per site).
- `admin.<domain>` must be in Firebase → Authentication → Authorized domains and in the Google OAuth client's JavaScript origins.

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
