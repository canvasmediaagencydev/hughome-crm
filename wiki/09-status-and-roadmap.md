# 09 — Status & roadmap

Everything on this page is drawn from the codebase, `MIGRATION_PLAN.md`, `docs/PHASE1_STATUS.md`,
`docs/PROMPTS.md`, and verification scripts that were actually run. Claims that were *not* verified
are marked as such.

## Current status

| | |
|---|---|
| Branch / deploy | `pilot-phase1` → https://pilot-phase1.vercel.app, commit `e3d83aa` |
| Supabase | pilot `zoaxqouayhjkyterzzdt`, `tenant_code = pilot` |
| Migrations | `001`–`020`, all applied |
| Sprints complete | 0, 1, 2, 2.1, 3, 3.1, pre-4, 4, 5 (partial) |
| Demo data | two seed sets applied — see the drift note below |

### ⚠️ Demo data drift

Two seed files have been applied to the pilot, and the second changed data the first one's assets
depend on:

- `supabase/seed/seed_demo_data.sql` — 4 sales reps, 2 campaigns, 8 customers. Paired with
  `docs/demo/` (10 rows, expected 687 points). Verified 19/19 when it was the only seed present.
- `supabase/seed/seed_mockdata50_customers.sql` — adds sales rep `S029` and 17 more customers, and
  **widens the 2× campaign from `2026-07-23 → 2026-08-05` to `2026-07-15 → 2026-08-05`** so that it
  covers a 50-row mock file.

Consequence, confirmed by re-running `node scripts/verify-demo-ready.js` (now **16/19**):

| Check | Was | Now |
|---|---|---|
| sales reps | 4 | 5 |
| original demo file total | 687 points | **874 points** — rows dated 20–22 July now fall inside the 2× window |
| a campaign is active today | yes | **no** — both windows ended before the current date |

Nothing is broken; the numbers moved. Before demoing, decide which set is the demo, then either
regenerate `docs/demo/` against the current campaign dates
(`node scripts/build-demo-batch.js`, which needs its hardcoded `CAMPAIGN` constant updated to match)
or move the campaign window back. `verify-demo-ready.js` is what tells you the two agree.

## Completed

### Sprint 0–1 — foundation
Strict env validation (zod, client/server split, fails at boot), tenant config with no defaults,
hardcoded LIFF fallback removed. Full schema: 4 enums, 20 tables, 5 RPCs, RLS enabled everywhere with
no permissive policies, RBAC with 27 permissions and 6 roles, `app_config` plus the tenant guard.

### Sprint 2–2.1 — security
Real LINE JWKS verification (signature, issuer, audience, expiry). httpOnly session cookie.
Middleware guard. Identity read from the session rather than the request body. OTP bound to
`verified_phone` so onboarding cannot claim an unverified number. Rate limiting on OTP send.
Redemptions tied to the session.

### Sprint 3–3.1 — removing the old flow
~30 OCR/receipt files deleted. Admin dashboard rewired onto the real tables. Schema applied to the
pilot, types regenerated.

### Gate #8 — the pilot was exercised end to end on a real phone
LINE login → OTP → registration → balance visible → reward redeemed → admin approved.

### pre-Sprint 4 — spec change (this is where the design changed shape)
Excel sheet went from 6 to 8 columns: added `วันที่ซื้อ`, `เลขที่บิล`, `พนักงานขาย`; removed
`Promo Code`. `xlsx` swapped for `exceljs`. Migrations `013`–`020` written and applied.

### Sprint 4 — parser and preview
`src/lib/excel/parse-sales-batch.ts` (pure, no database) and
`POST /api/admin/batches/upload` producing a dry-run preview.
Self-check: **29/29**.

### Sprint 5 — commit, void, and the UI
`commit` / `void` / `list` endpoints, live template generation, sales-reps CRUD, and the
`/admin/batches` and `/admin/sales-reps` pages. Template builder moved to
`src/lib/excel/build-template.js` so the CLI script and the API route share one implementation.
Added the `batch_award` LINE notification kind.

## Remaining

| Sprint | Work |
|---|---|
| 5 (leftover) | `POST /api/admin/batches/:id/review` (manager records a spot-check), `GET /api/admin/batches/:id` (batch detail) |
| 6 | Campaign UI — `/api/admin/campaigns` CRUD and `/admin/campaigns`. Must translate Postgres `23P01` into readable Thai naming the conflicting campaign, and gate on `campaigns.manage` so `accounting` cannot set multipliers |
| 7 | Step-wise expiry cron, LINE push (points in, expiry warning, birthday), LINE quota cache, FIFO redemption, daily balance reconcile that logs and alerts but never auto-fixes. Also update `vercel.json` to the §6.3 cron paths |
| 8 | Telegram / LINE group notify, redemption 4 statuses + QR, cancel with points returned, clean up the legacy `processing` / `shipped` status values |
| 9 | Customer UI (5-tab bottom nav, `/call`, `/facebook`), admin polish, weekly reports with bill number and salesperson columns, demo data |

## Locked decisions

Each of these is a decision that was made explicitly and should not be revisited without a reason.

| Decision | Why | Where |
|---|---|---|
| Promo code column removed; multipliers are back-office date ranges | project owner: "ป้องกันการทุจริต" — the person keying amounts must not choose the multiplier | migration 014, `sales-columns.json` |
| `earned_month` comes from the purchase date per row, not commit time | an accounting delay across a month boundary would otherwise grant an extra month of validity | migration 017/020 |
| Bill numbers unique system-wide, except in voided batches | one bill earns points once; voiding releases the number for a corrected re-upload | `pbl_bill_no_active_idx` |
| Sales staff have no login; accounting uploads | `uploaded_by` references `admin_users`, whose `auth_user_id` is UNIQUE NOT NULL — a login per salesperson was out of scope | `sales_reps` table |
| Campaign date ranges may not overlap | one multiplier per day, so selection is deterministic and needs no tie-break rule | `point_campaigns_no_overlap` |
| Four separate audit actors per batch | uploader, committer, reviewer, voider can all be different people | migration 019 |
| `award_points_from_batch` 1-arg version dropped, not overloaded | an overload is how someone accidentally calls the version that records nobody | migration 020 |
| `xlsx` removed, `exceljs` adopted | prototype pollution + ReDoS make `xlsx` unusable for parsing uploaded files | `package.json` |
| Unmatched phones are reported, never auto-created | a typo would otherwise mint a ghost account that real points flow into | parser |
| Table named `sales_reps`, not `sales_staff` | `sales_staff` is already an `admin_roles.name` value | migration 013 |
| `seed_demo_data.sql` lives outside the migration path | `supabase db push` must never load demo customers into a real branch | `supabase/seed/` |

## Open debt

### Operational
- Rotate the admin password and the LINE / Supabase keys that were pasted into a chat transcript
- Delete pilot test data (one user holding 400 points, sample rewards)
- Real SMS provider — OTP currently works for a single test number
- Two rewards have no image: `เสื้อยืด Hughome`, `บัตรกำนัล 500 บาท` (upload at `/admin/rewards`)
- Remaining placeholders: shop phone number, Telegram bot/group (Sprint 8)

### Technical
- `tenant-guard` is soft — `instrumentation.ts` catches its throw and only logs
- `exceljs` advisories (`archiver` → `glob` → `minimatch` → `brace-expansion`, and `uuid` v3/v5/v6),
  on the zip write path rather than the untrusted read path
- `/api/upload` returns 500 instead of 401 for a non-admin
- `vercel.json` cron paths do not match `MIGRATION_PLAN.md` §6.3; two crons are no-ops
- Legacy `processing` / `shipped` still present in the redemption status type
- Stale receipt/OCR references remain in `src/app/admin/page.tsx`,
  `src/components/StatusBadge.tsx`, dashboard metrics routes, `TESTING_GUIDE.md`,
  `ADMIN_RBAC_TASKS.md`, and `GEMINI_API_KEY` in `.env.example`
- `database.types.ts` was hand-edited; `supabase gen types` has never been run against `013`–`020`.
  `verify-types.js` covers `Tables` only, not `Enums` / `Functions` / `CompositeTypes`
- A fresh Phase 2 database will `CREATE promo_codes` in `005` and `DROP` it in `015` — harmless noise
  kept so history stays honest; squash only when Phase 2 starts
- `/docs` is git-ignored, so `PHASE1_STATUS.md`, `PROMPTS.md`, and the demo assets are not in git

### Verified vs not verified

| | |
|---|---|
| Parser self-check | ✅ 29/29 |
| Demo file vs hand-computed points | ✅ 17/17 |
| Seed vs demo file, read from the live database | ✅ 19/19 |
| End-to-end money path on the pilot database | ✅ 23/23 |
| Schema on the pilot | ✅ 13/13 plus behavioural constraint checks |
| `tsc --noEmit`, `npm run build` | ✅ |
| Deployed routes reachable, APIs return 401 unauthenticated | ✅ |
| **Full flow through a browser with a real login** | ❌ **never done** |

The last row is the important one. Roughly 40 files of new code have been proven at the database and
parser layers, and the HTTP layer has only been smoke-tested.

## Next recommended step

**1. Click through the whole flow in a browser on the deployed pilot. No code.**

It is the only untested layer, and the demo depends on it. Log in as admin →
`/admin/sales-reps` (4 seeded reps) → `/admin/batches` → download the template → upload
`docs/demo/demo-ยอดขาย-2026-07-20_2026-07-26.xlsx` with week `2026-07-20` → `2026-07-26`.
Expect 8 green, 1 yellow, 1 red, 687 points. Confirm, check balances at `/admin/users`, then check
the history row shows both "uploaded by" and "points-in by".

After committing, void the batch before re-uploading the same file — `file_sha256` blocks duplicates.

Any bug found here is cheaper than any Sprint 6 feature.

**2. Then Sprint 6 — campaign UI.**

Smallest remaining sprint and demo-visible. Campaigns can currently only be created through the SQL
Editor, so the back office is incomplete without it.
