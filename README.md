# HugHome CRM — "Hug Point"

A LINE-based loyalty platform for a Thai building-materials retailer.
Customers (contractors and homeowners) collect points from their purchases and redeem rewards
in store. Points are entered by the shop, not by customers.

**Phase 1 (current):** a fresh pilot instance for the customer to trial.
The existing production branch with ~700 real customers is untouched.

---

## How points get into the system

```
Sales staff  →  fill the weekly Excel sheet (purchase date, bill no, customer phone, amount, salesperson)
Accounting   →  upload the .xlsx, pick the week, review the preview, confirm
System       →  match customer by phone, apply the campaign multiplier for that purchase date,
                compute points, write the ledger, update the balance, push a LINE message
Manager      →  spot-check the weekly report against real bills; void the batch if it is wrong
Customer     →  opens LIFF, sees the balance and next expiry, redeems a reward, picks it up in store
```

There is **no receipt photo upload and no OCR**. That was an earlier design and has been removed.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the real values
npm run dev                    # http://localhost:3000
```

Every environment variable is validated at boot by `src/config/env.ts`. There are **no defaults** —
if something is missing the app throws and tells you which variable.

Note that `LINE_CHANNEL_ID` comes from the LINE **Login** channel while
`LINE_CHANNEL_ACCESS_TOKEN` comes from the **Messaging API** channel. They are different channels.

### Database

Migrations live in `supabase/migrations/` (`001`–`020`) with matching down-scripts in
`rollback/`. Apply them by pasting `supabase/_apply_all.sql` into the Supabase SQL Editor
(fresh database) or `supabase/_apply_013_020.sql` (a database that already has `001`–`012`).

> Run migrations one file at a time if a combined paste fails. The Supabase SQL Editor wraps the
> whole run in a single transaction, so one bad statement silently rolls back everything.

Demo data is `supabase/seed/seed_demo_data.sql` — deliberately **outside** the migration path so
`supabase db push` never runs it. Do not run it against Phase 2 production.

---

## Tech stack

Next.js 15.5.2 (App Router) · React 19.1.0 · TypeScript 5 (strict) · Tailwind CSS 4 · shadcn/ui ·
Supabase (Postgres, RLS, Storage) · LINE Login via LIFF + Messaging API · `exceljs`

---

## Verification

There is no test framework. Verification is a set of scripts, each of which exits non-zero on failure:

| Command | Checks |
|---|---|
| `npx tsc --noEmit` | types |
| `npm run build` | production build |
| `node scripts/test-parse-sales-batch.js` | Excel parser against every edge case (no DB needed) |
| `node scripts/verify-schema.js` | live database schema matches what the code expects |
| `node scripts/verify-types.js` | `database.types.ts` matches the live database |
| `node scripts/verify-demo-ready.js` | the pilot database is ready to demo |
| `node scripts/e2e-batch-flow.js` | ⚠️ writes to the DB — full money path, then cleans up after itself |

---

## Documentation

| Where | What |
|---|---|
| `CLAUDE.md` | Entry point for AI agents — objectives, hard rules, current state |
| `wiki/` | Architecture, data model, batch flow, anti-fraud design, RBAC, runbooks, roadmap |
| `MIGRATION_PLAN.md` | The original decision record. Authoritative on *why* things are the way they are |
| `AGENTS.md` | Repository conventions |
| `supabase/README.md` | Migration runbook |
| `docs/` | Working notes, sprint prompts, demo assets — **git-ignored, local only** |

---

## Deployment

Branch `pilot-phase1` deploys to Vercel production at https://pilot-phase1.vercel.app.
`main` is not used for the pilot.
