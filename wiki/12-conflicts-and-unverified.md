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

### 2. `vercel.json` cron paths — **resolved in Sprint 7 (2026-09-13)**

`vercel.json` now uses the four §6.3 paths. One deliberate deviation remains and is documented in
`wiki/07-environment-and-deployment.md`: `/api/cron/expire-points-monthly` is scheduled **daily**
(`0 18 * * *` UTC = 01:00 Bangkok) rather than on the 1st, because `expires_at` can fall mid-month
after a leap day and a lot that has expired but not been swept breaks `redeem_reward`'s FIFO. The RPC
is idempotent, so the daily run is harmless. `MIGRATION_PLAN.md` §6.3 still says `0 1 1 * *`.

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

### 7. The customer's 2026-09-21 handoff vs the code — recorded, not resolved

Full mapping in `wiki/14-customer-meeting-2026-09-delta.md`. The conflicts, in one place:

| Customer asks | Code / locked decision says | Resolution |
|---|---|---|
| Points expire 365 days from the **upload** date | `earned_month` from the **purchase** date (migration 017/020, locked in `wiki/09`) | **Resolved 2026-09-21 — Q4 confirmed.** Migration `025`: expiry = approval date + 365. Old lots keep their dates |
| Approver confirms **before** points enter; no auto-approve | accounting commits directly; manager spot-checks **after** (`batches.review`, unbuilt) | **Built 2026-09-21** — migration `024`, `pending_approval`, `batches.approve`. Q3 (who voids) and Q12 (spot-check after) still open |
| Excel: `รหัสลูกค้า` mandatory; brief's schema has **no `วันที่ซื้อ`** | 8 columns, `วันที่ซื้อ` required — the multiplier and week check depend on it; the customer's own mock template still has it | **Resolved 2026-09-21 — Q5 approved.** 9-column v2 in `sales-columns.json`; `วันที่ซื้อ` kept; code is a cross-check warning, phone stays the key |
| `ยอดลดหนี้` mandatory | optional, blank = 0 (parser, and the customer's own guide sheet) | Keep optional unless told otherwise (Q5) |
| Cut "LINE API" team notification | Sprint 8 uses LINE **Messaging API** group push + Telegram, never LINE Notify | Ask which one they mean (Q6) |
| Export report has **no bill number** | `MIGRATION_PLAN.md` §8.2 reversal (§5 above): the manager report **needs** bill numbers | Two reports: customer export (no bill) and weekly batch report (with bill). Both stand |
| Rename "พนักงานขาย" → "Maker" everywhere | table `sales_reps`, role `sales_staff`, Excel header `พนักงานขาย` | Labels and guide sheet yes; table/role names no; Excel header only with Q5 |
| "Rollback" with `rolled_back_by/at/reason` | `void_batch` with `voided_by/at`, `void_reason` — same thing | Naming only; no new columns |
| Dashboard across both branches (older Meeting Pack) | one tenant per instance (`CLAUDE.md` §2 engineering objective 4) | Stays a non-goal; the newer handoff does not repeat the ask |
| Customer ID format `HUG-YYYYMM-####` (brief) | `customer_code` is free text; the customer's mockup shows old IDs like `HH-000423` | Q1 |

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

**The twelve customer questions from 2026-09-21** — `wiki/14` §4, Q1–Q12. Q4 (expiry base), Q5 (Excel
v2) and Q3/Q12 (approval step) block Sprint 9 batch work; the rest can be answered during it.
