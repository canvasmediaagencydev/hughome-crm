# 12 — Conflicts & unverified claims

Written to the instruction: use only what is verifiable from the codebase, current implementation,
existing docs, and this project's chat history. Where sources disagree, record the conflict rather
than pick a winner.

## Documents that contradict the code

### 1. `TESTING_GUIDE.md` and `ADMIN_RBAC_TASKS.md` describe the deleted OCR system

31 and 16 receipt/OCR references respectively. They describe a "Receipt Manager" role, receipt
approval flows, and OCR permissions. None of that exists — the tables and routes were removed in
Sprint 3.

**Not rewritten.** Rewriting them would require deciding what the current manual-test checklist
should be, which is a scope decision, not a documentation fix. **Do not trust these two files.**

### 2. `vercel.json` cron paths do not match `MIGRATION_PLAN.md` §6.3

| `vercel.json` (actual) | §6.3 (planned) |
|---|---|
| `/api/cron/birthday-greetings` `0 2 * * *` | `/api/cron/birthday-greetings` `0 2 * * *` |
| `/api/cron/points-expiry-reminder` `0 2 * * *` | `/api/cron/points-expiry-warning` `0 2 1 * *` |
| `/api/cron/expire-points` `30 17 * * *` | `/api/cron/expire-points-monthly` `0 1 1 * *` |
| — | `/api/cron/reconcile-balances` `0 3 * * *` |

The two mismatched crons are no-ops. `PHASE1_STATUS.md` lists updating `vercel.json` as Sprint 7
work, so this is a known gap rather than an unnoticed contradiction.

### 3. `GEMINI_API_KEY` still listed in `.env.example`

Left over from the OCR flow. No current code path was found using it for OCR.
Not removed, because removing an environment variable could break a deploy if something still reads
it — that needs a check, not a guess.

### 4. `AGENTS.md` referenced files that do not exist

It pointed at `docs/architecture.md` and a "PRD series" in `docs/`. `docs/architecture.md` is not
present. `AGENTS.md` has been rewritten; the old text is in git history.

### 5. `MIGRATION_PLAN.md` §8.2 originally said the report should drop the bill-number column

That was reversed during pre-Sprint 4: manager spot-checks need the bill number to compare against
paper documents. `MIGRATION_PLAN.md` was updated in place and now says the column must be present.
Noted here because the reversal is easy to mistake for an error.

### 6. Stale receipt references still in `src/`

`src/app/admin/page.tsx`, `src/app/admin/roles/page.tsx`, `src/app/api/admin/dashboard/all/route.ts`,
`src/app/api/admin/dashboard/metrics/route.ts`, `src/app/api/admin/analytics/route.ts`,
`src/components/StatusBadge.tsx`, `src/components/admin/dashboard/UsageStatistics.tsx`,
`src/hooks/useDashboard.ts`, `src/lib/line-messaging.ts`.

`line-messaging.ts` keeps a `receipt_approved` notification kind that is unused by current flows.
These were not touched — dashboard cleanup is Sprint 9.

## Claims that could not be verified

| Claim | Status |
|---|---|
| Vercel environment variable values, including `NEXT_PUBLIC_TENANT_CODE` | **Unverified.** Not readable from the agent shell. Local `.env.local` says `pilot` and the database says `pilot`; production is assumed to match but has not been checked. This gates the tenant-guard decision |
| `pbl_bill_no_active_idx` exists on the pilot | **Unverified directly.** PostgREST cannot see indexes. It was confirmed *indirectly*: `e2e-batch-flow.js` observed a duplicate bill rejected with `23505`, which only that index produces |
| `database.types.ts` `Enums` / `Functions` / `CompositeTypes` | **Unverified.** The file was hand-edited from the live PostgREST OpenAPI schema because `supabase gen types` needs an interactive login. `verify-types.js` covers `Tables` only: 20/20 tables, 178 columns |
| Full browser flow with a real admin login | **Never run.** Pages return 200 and unauthenticated APIs return 401; nothing above that has been exercised |
| Product category ("building materials") | **Inference.** Not stated in any document. Sample data references กระเบื้อง (tiles) and ผู้รับเหมา |
| Why the OCR paradigm was abandoned | **Not recorded.** `MIGRATION_PLAN.md` states the change as a decision without a written justification. No reason is asserted in this wiki |

## Decisions still open

**Should `tenant-guard` fail closed?** `PHASE1_STATUS.md` has carried this as an unresolved question
since before Sprint 4: *"ต้องตัดสินว่าจะกลับเป็น hard-refuse ตอน prod จริงไหม"*. It remains open. It
requires confirming the Vercel environment value first, otherwise the site returns errors everywhere.

**Should `maxFileBytes` drop from 5 MB to 4 MB?** Vercel caps a serverless request body at roughly
4.5 MB, so files between the two sizes fail at the platform with an unhelpful error. Proposed, not
changed — `sales-columns.json` may not be edited without approval. A realistic 5,000-row file is
about 300 KB, so nothing has hit this.

**Should the `005` create / `015` drop of `promo_codes` be squashed for Phase 2?** Deferred to when
Phase 2 begins.
