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
| Supabase project ref | `zoaxqouayhjkyterzzdt` |
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

## Cron

`vercel.json` currently registers:

```json
{ "path": "/api/cron/birthday-greetings",     "schedule": "0 2 * * *"  }
{ "path": "/api/cron/points-expiry-reminder", "schedule": "0 2 * * *"  }
{ "path": "/api/cron/expire-points",          "schedule": "30 17 * * *" }
```

`expire-points` and `points-expiry-reminder` are **no-ops** awaiting Sprint 7.

> **Conflict.** `MIGRATION_PLAN.md` §6.3 specifies different paths and schedules:
> `/api/cron/expire-points-monthly` (`0 1 1 * *`), `/api/cron/points-expiry-warning` (`0 2 1 * *`),
> `/api/cron/birthday-greetings` (`0 2 * * *`), `/api/cron/reconcile-balances` (`0 3 * * *`).
> `vercel.json` has not been updated; that is listed as Sprint 7 work.

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
npx supabase gen types typescript --project-id zoaxqouayhjkyterzzdt > /tmp/t.ts && mv /tmp/t.ts database.types.ts
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
