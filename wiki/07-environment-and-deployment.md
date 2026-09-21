# 07 — Environment & deployment

## Deployment

| | |
|---|---|
| Branch | `pilot-phase1` |
| Target | Vercel **production**, https://pilot-phase1.vercel.app |
| `main` | not used for the pilot; deliberately untouched |
| Last verified commit | `e3d83aa` |

Pushing `pilot-phase1` triggers the production deploy. A build took roughly 50 seconds in the one
push observed (`/admin/batches` went 404 → 404 → 200 across three polls 25 s apart).

Verified live after that deploy:

```
200  /admin/batches      200  /admin/sales-reps      200  /admin
401  /api/admin/batches  401  /api/admin/batches/template  401  /api/admin/sales-reps
```

Unauthenticated API calls return `{"error":"Unauthorized"}` — correct.

## Environment variables

The full list with sourcing comments is `.env.example`. All are validated at boot by
`src/config/env.ts`; there are **no defaults** for any of them.

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        server only — never expose to the client
NEXT_PUBLIC_LINE_LIFF_ID
LINE_CHANNEL_ID                  from the LINE Login channel
LINE_CHANNEL_ACCESS_TOKEN        from the Messaging API channel — a different channel
SESSION_SECRET
CRON_SECRET
NOTIFICATIONS_ENABLED            kill switch for LINE push
NOTIFY_TOKEN_KEY                 Sprint 8 — 64 hex (openssl rand -hex 32); encrypts the Telegram bot
                                 token in notification_channels. Optional at boot; saving or sending a
                                 Telegram channel without it throws (no plaintext fallback). Changing
                                 the key makes every stored token unreadable — re-enter them.
NEXT_PUBLIC_TENANT_CODE
NEXT_PUBLIC_TENANT_NAME
NEXT_PUBLIC_TENANT_SEGMENT
NEXT_PUBLIC_TENANT_PHONE
NEXT_PUBLIC_TENANT_LINE_OA
NEXT_PUBLIC_TENANT_FB_URL
GEMINI_API_KEY                   ⚠️ leftover from the deleted OCR flow — see conflicts
```

Server-only keys are validated server-side only, so they cannot leak into the client bundle.

`.env.local` holds live pilot credentials and must never be edited by an agent or committed
(`.gitignore` has `.env*` with `!.env.example`).

## Known values (pilot)

| | |
|---|---|
| Supabase project ref | `vltzkxmblmrvsmaookhl` — project `hughome-pilot`, Supabase account `canvasmediaagency@gmail.com`, region ap-northeast-1 (Tokyo), created 2026-09-14 |
| `app_config.tenant_code` | `pilot` |
| `NEXT_PUBLIC_TENANT_CODE` (local) | `pilot` — matches |
| `NOTIFICATIONS_ENABLED` (local) | `false` — LINE push is off |
| LIFF | `2010850077-4iXzuV6k` (Login channel `2010850077`) |
| Messaging channel | `2010850181` |
| `baht_per_point` | 100 |
| Storage bucket | `rewards` |

> The Vercel environment could not be read from the agent shell. Local values are confirmed;
> production values are **not**. This matters for `NEXT_PUBLIC_TENANT_CODE` — see the tenant-guard
> note below.

## Tenant guard

`src/config/tenant-guard.ts` compares `TENANT.code` against `app_config.tenant_code` at boot.

Current behaviour, exactly:

- read failure or missing row → logged, **not** fatal
- definite mismatch → `throw`
- but `src/instrumentation.ts` wraps the call in try/catch and logs
  `"tenant-guard failed (non-fatal — app continues)"`

So a build pointed at the wrong branch's database keeps serving. Making it fail closed means having
middleware refuse requests, and requires first confirming that `NEXT_PUBLIC_TENANT_CODE` on Vercel is
exactly `pilot` — otherwise the entire site starts erroring.

This decision is **open**. It was proposed as a commit message once and was not implemented, because
implementing it was not what the commit actually contained.

## Why the pilot project was recreated (2026-09-14)

The original pilot `zoaxqouayhjkyterzzdt` (created 2026-07-27) could not be found in any Supabase
account the team can log into, and DDL run in the SQL editor that appeared to target it never became
visible through its REST API (PostgREST kept serving the 20 pre-existing tables). The most likely
cause, seen on the new-project form, is the **"Automatically expose new tables"** setting — when off,
tables created after project creation are not granted to the Data API roles. With no dashboard access
that could not be fixed, so a fresh project was created with that setting **on**, `_apply_all.sql`
(001–022) applied in three chunks, the demo seed run, the admin recreated, and the three Supabase env
values swapped in `.env.local` and on Vercel (production + preview, via `vercel env`).

Data from the old project was **not** migrated (only demo customers, one internal test user, and a
handful of test redemptions lived there). Reward images must be re-uploaded. The old project should
be deleted once its owner account is found.

## Cron

`vercel.json` (Sprint 7, matches `MIGRATION_PLAN.md` §6.3 paths). Schedules are **UTC** on Vercel.

```json
{ "path": "/api/cron/expire-points-monthly", "schedule": "0 18 * * *" }   // 01:00 Bangkok, daily
{ "path": "/api/cron/points-expiry-warning", "schedule": "0 2 1 * *"  }   // 09:00 Bangkok, 1st of month
{ "path": "/api/cron/birthday-greetings",    "schedule": "0 2 * * *"  }   // 09:00 Bangkok, daily
{ "path": "/api/cron/reconcile-balances",    "schedule": "0 3 * * *"  }   // 10:00 Bangkok, daily
```

Every cron checks `verifyCronRequest()` (`Authorization: Bearer $CRON_SECRET`) before touching the
database or LINE. `scripts/verify-cron-auth.js <base-url>` proves all four return 401 unauthenticated.

| Cron | Does | Money |
|---|---|---|
| `expire-points-monthly` | RPC `expire_ledger_batches(today)` — lots with `expires_at < today` → `points_remaining = 0`, balance down, `point_transactions` `expired`; then LINE "แต้มหมดอายุแล้ว" per affected user, deduped per day | RPC only |
| `points-expiry-warning` | lots expiring within 3 months → one LINE warning per user, deduped per `(user, lot expires_at)` so a lot is warned once | read-only |
| `birthday-greetings` | LINE greeting, deduped per `(user, year)` | read-only |
| `reconcile-balances` | RPC `reconcile_balances()`; writes `balance_reconcile_log`; on drift logs `console.error` and returns **500** so Vercel marks the run failed. Never auto-fixes | read-only |

> `expire-points-monthly` is scheduled **daily**, not on the 1st as the plan's name suggests. Since
> migration `025` (Q4, 2026-09-21) `expires_at` is "approval date + 365 days" — an arbitrary day of the
> month for every lot — so the daily run is now essential, not a safety margin. (Before `025` it was
> "last day of earned month + 365", which only landed mid-month across a 29 February.) Waiting for the
> 1st would leave expired lots in `points_balance` but excluded from `redeem_reward`'s FIFO, and a
> redemption larger than the active lots would fail with `ledger/balance mismatch`. The RPC is
> idempotent.

LINE pushes are fire-and-forget: a failed push is counted in the response (`push_failed`) and not
logged to `notification_log`, so the next run retries it; it never fails the cron.

Old routes `/api/cron/expire-points` and `/api/cron/points-expiry-reminder` were deleted in Sprint 7.

## Local setup

```bash
npm install
cp .env.example .env.local     # fill in real values
npm run dev                    # http://localhost:3000
```

`npm run build` uses Turbopack. `npm run build:analyze` sets `ANALYZE=true`.

## Regenerating database types

Requires an interactive Supabase login, which an agent shell cannot do
(`Cannot use automatic login flow inside non-TTY environments`).

```bash
npx supabase login
npx supabase gen types typescript --project-id vltzkxmblmrvsmaookhl > /tmp/t.ts && mv /tmp/t.ts database.types.ts
npx tsc --noEmit
```

> Never redirect straight onto `database.types.ts`. The shell truncates the target **before** the
> command runs, so a failed login leaves a 0-byte file. This happened once; recovery was
> `git restore database.types.ts`.

`database.types.ts` was last updated **by hand**, derived from the live PostgREST OpenAPI schema,
because the CLI could not be authenticated. It was then verified by `scripts/verify-types.js`:
20/20 tables, 178 columns, all nullability matching. That script checks `Tables` only — it cannot
verify `Enums`, `Functions`, or `CompositeTypes`, so a real `supabase gen types` run is still
outstanding.
