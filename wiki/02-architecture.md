# 02 — Architecture

## Runtime shape

```
   Customer (in the LINE app)                 Shop staff (browser)
            │                                          │
      LIFF SDK 2.27.2                            /admin/* pages
            │  idToken                                 │  Supabase Auth session
            ▼                                          ▼
   POST /api/liff/login                        requireAdmin / requirePermission
   verify against LINE JWKS                    (src/lib/admin-auth.ts)
   (signature, iss, aud, exp)                          │
            │                                          │
            └──────────► Next.js App Router ◄──────────┘
                                │
                    service_role Supabase client
                       (server-side only)
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
        Postgres (RLS on,               LINE Messaging API
        no permissive policies)         (push notifications)
                │
        RPC: award_points_from_batch, void_batch, redeem_reward,
             expire_ledger_batches, adjust_points_manual
```

## Two separate identity systems

They never mix.

**Customers** are rows in `user_profiles`, identified by `line_user_id`. They authenticate through
LINE Login inside LIFF. The server verifies the `idToken` against LINE's JWKS endpoint — checking
signature, issuer, audience, and expiry — then issues an httpOnly session cookie. Identity always
comes from that session, never from a request body.

**Admins** are rows in `admin_users`, backed by Supabase Auth (`auth_user_id`). They log in with
email and password at `/admin/login`.

**Sales staff are neither.** They are rows in `sales_reps` — just a name and a code. They have no
login and never touch the system; they only fill in a spreadsheet. This is deliberate: giving every
salesperson a Supabase Auth account was rejected as out of scope, and `sales_reps` stays a light
table so a name can be added in seconds.

## Security model

Row Level Security is enabled on **every** table with **no permissive policies**. `anon` and
`authenticated` are therefore denied by default. All data access goes through server-side API routes
using the `service_role` key, which bypasses RLS. This is defence in depth: if the anon key leaks,
it reads nothing.

The service role key is server-only and must never reach client code. Server clients live in
`src/lib/supabase-server.ts` and inside API routes.

## Configuration and the tenant guard

`src/config/env.ts` validates every environment variable at import time using zod, and throws with
the list of missing names. Client-visible (`NEXT_PUBLIC_*`) and server-only variables are validated
separately so that server secrets cannot leak into the client bundle.

`src/config/tenant.ts` exposes `TENANT` (code, name, segment, phone, LINE OA id, Facebook URL), read
entirely from `NEXT_PUBLIC_TENANT_*`. **No defaults** — in Phase 2 there will be two instances, and a
default would let a mis-deploy point one branch's build at another branch's database with nobody
noticing.

`src/config/tenant-guard.ts` runs at server boot (via `src/instrumentation.ts`) and compares
`TENANT.code` with `app_config.tenant_code` in the connected database.

> **Current limitation.** The guard throws on a definite mismatch, but `instrumentation.ts` catches
> the error and only logs it, so the app keeps serving. Making it fail closed requires first
> confirming that `NEXT_PUBLIC_TENANT_CODE` on Vercel is exactly `pilot`, otherwise the whole site
> goes down. This decision is still open.

## Directory layout

```
src/
  app/
    (customer LIFF pages)      page.tsx, onboarding, dashboard, rewards, profile
    admin/                     admin pages — batches, sales-reps, users, rewards,
                               redemptions, tags, admins, roles, reports
    api/
      liff/login               LINE idToken verification
      phone/                   OTP send + verify
      onboarding               profile creation
      rewards/redeem           redemption
      admin/                   all back-office endpoints
      cron/                    scheduled jobs (several are no-ops until Sprint 7)
  components/                  shared UI, shadcn/ui in components/ui
  config/                      env, tenant, tenant-guard
  hooks/                       useAdminAuth, useDashboard, ...
  lib/
    excel/                     column spec, parser, template builder
    admin-auth.ts              requireAdmin / requirePermission / permission lookups
    supabase-server.ts         service_role client
    line-auth.ts               JWKS verification
    line-messaging.ts          push helpers
    phone.ts                   Thai phone normalization
  types/admin.ts               PERMISSIONS constants, role names
supabase/
  migrations/                  001-020 up, rollback/ down
  seed/                        manual-only seed data (never auto-applied)
  _apply_all.sql               generated: full 001-020
  _apply_013_020.sql           generated: incremental
scripts/                       generators and verification scripts
wiki/                          this documentation
docs/                          working notes — GIT-IGNORED, local only
```

## Excel handling

All Excel reading and writing uses `exceljs`.

`xlsx@0.18.5` was removed. It carries prototype pollution and ReDoS advisories, which is acceptable
for writing a report but not for parsing a file an admin uploads. Do not reintroduce it.

`exceljs` brings its own advisories (`archiver` → `glob` → `minimatch` → `brace-expansion`, and
`uuid` v3/v5/v6). Both sit on the zip **write** path rather than the untrusted-input **read** path,
which is why the swap was still an improvement — but it is not the same as "no vulnerabilities", and
it should be revisited.

Switching to `exceljs` also unlocked things the old library could not do in the template: a real
dropdown for the salesperson column, a frozen header row, text formatting on the phone and bill
columns (so a leading zero survives), and date/amount validation.
