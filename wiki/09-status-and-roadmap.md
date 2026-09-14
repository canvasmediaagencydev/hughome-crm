# 09 — Status & roadmap

Everything on this page is drawn from the codebase, `MIGRATION_PLAN.md`, `docs/PHASE1_STATUS.md`,
`docs/PROMPTS.md`, and verification scripts that were actually run. Claims that were *not* verified
are marked as such.

## Current status

| | |
|---|---|
| Branch / deploy | `pilot-phase1` → https://pilot-phase1.vercel.app, commit `ceaa90f` (Sprint 6–7 live, 2026-09-14) |
| Supabase | pilot `vltzkxmblmrvsmaookhl`, `tenant_code = pilot` |
| Migrations | `001`–`022` all applied (fresh pilot project 2026-09-14) |
| Sprints complete | 0, 1, 2, 2.1, 3, 3.1, pre-4, 4, 5 (partial), 6, 7 |
| Demo data | `docs/demo/` (10 rows · 687 points) · `verify-demo-ready.js` 19/19 |

### Demo data — resolved 2026-08-31

Two seed files had been applied and the second one moved data the first one's assets depend on:
`seed_mockdata50_customers.sql` widened the 2× campaign from `2026-07-23 → 2026-08-05` to
`2026-07-15 → 2026-08-05`, which pushed the 10-row demo file from 687 to 874 points, and added
sales rep `S029` plus 17 `Udemo50-%` customers for a 50-row file that is no longer in the repo.

`docs/demo/` (10 rows, 687 points) is now the demo set. `node scripts/repair-demo-data.js`
restored the 2× window, deleted the mock50 rows (none were referenced by any ledger), and added a
third demo campaign — `ฮักโฮมปลายฝน รับแต้ม 1.5 เท่า`, ×1.5, `2026-08-15 → 2026-12-31` — so a
campaign is active on the day of the demo without touching the July numbers. The campaign is also
in `seed_demo_data.sql`, so a fresh Phase 2 seed reproduces the same state.

`node scripts/verify-demo-ready.js` is now **19/19**. Re-run it after touching any seed.
`seed_mockdata50_customers.sql` is kept with a conflict warning in its header; running it again
re-breaks the demo file, and `repair-demo-data.js` undoes it.

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

### 2026-09-13 — money-path fix + Sprint 6
Migration `021`: `redemption_lots`, `redeem_reward` v2, `cancel_redemption` RPC. The two routes that
bypassed RPC (`redemptions/[id]/cancel`, `users/[id]/points`) now call `cancel_redemption` /
`adjust_points_manual`. One-off `supabase/fixes/2026-09-13_reconcile_cancel_drift.sql` repairs the
pre-existing balance/ledger drift.

### Sprint 6 — campaign UI
`GET/POST /api/admin/campaigns`, `GET/PATCH/DELETE /api/admin/campaigns/:id`, `/admin/campaigns`
page, nav item. Overlap is checked client-side, server-side (409 naming the conflicting campaign
and its range), and by the DB (`23P01` translated to the same message). `DELETE` is refused with a
Thai message when `point_batch_ledger` references the campaign (`23503`); deactivate instead.
`campaigns.manage` gates POST/PATCH/DELETE, so `accounting` (view only) gets 403.
Offline self-check `scripts/test-campaign-rules.mjs`: **18/18**. Clicked through on local dev against the
pilot DB 2026-09-13: create/overlap/edge/toggle/edit/delete all behave; API probes gave 409/400/404/401
as designed; `accounting` gets 403 on POST/PATCH/DELETE and sees a read-only page. Not yet exercised:
`23503` refusal on delete (needs a committed batch referencing the campaign) and a DB-level `23P01`
race (pre-check always catches it first).

### Sprint 7 — step-wise expiry + cron + LINE push
Migration `022` (`notification_log`, `balance_reconcile_log`, `reconcile_balances()`). Four crons at the
§6.3 paths (`vercel.json` rewritten; old `expire-points` / `points-expiry-reminder` routes deleted).
Expiry executes only through `expire_ledger_batches`; warnings 1–3 months ahead deduped per lot expiry
date; birthday deduped per year; reconcile is read-only and fails the run (500) on drift. LINE quota
cached in `line_quota_cache` via `GET /api/admin/quota` (15 min). Customer dashboard shows
"แต้ม X จะหมดอายุ [เดือน]" from the nearest lot. `scripts/verify-cron-auth.js` **15/15** on local.
`scripts/e2e-points-invariant.js --yes` **36/36** and `e2e-batch-flow.js` **23/23** on the new pilot (2026-09-14). FIFO on redeem was
already in `redeem_reward` since `010`. See `wiki/07` for the daily-vs-monthly expiry schedule decision.

## Remaining

| Sprint | Work |
|---|---|
| 5 (leftover) | `POST /api/admin/batches/:id/review` (manager records a spot-check), `GET /api/admin/batches/:id` (batch detail) |
| 8 | Telegram / LINE group notify, redemption 4 statuses + QR (points-returning cancel already done via `cancel_redemption`), clean up the legacy `processing` / `shipped` status values |
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
- **Admin login on the new pilot has never succeeded** (`auth.users.last_sign_in_at` is null as of
  2026-09-14): set the password with `auth.admin.updateUserById` (service role) — the app has no
  password-reset page, so the recovery email cannot be used
- Rotate the admin password and the LINE / Supabase keys that were pasted into a chat transcript
- Old pilot project `zoaxqouayhjkyterzzdt` still exists somewhere (owner account unknown) — find and delete
- Reward images: all three rewards on the new pilot have no image yet (`/admin/rewards`)
- Vercel account shows **Payment failed / pay open invoices** — deploys and crons stop if unpaid
- Real SMS provider — OTP currently works for a single test number
- Two rewards have no image: `เสื้อยืด Hughome`, `บัตรกำนัล 500 บาท` (upload at `/admin/rewards`)
- Remaining placeholders: shop phone number, Telegram bot/group (Sprint 8)

### Technical
- **Fixed in code 2026-09-13, migration `021` applied:** the two routes that moved money with a direct
  `UPDATE` (`redemptions/[id]/cancel`, `users/[id]/points`) now call `cancel_redemption` /
  `adjust_points_manual`. Existing drift on the pilot (test customer balance 400 vs ledger 300) is
  *not* repaired by the migration — run `supabase/fixes/2026-09-13_reconcile_cancel_drift.sql`
  (one-off, after `021`; refuses to run unless exactly one user has drift)
- `tenant-guard` is soft — `instrumentation.ts` catches its throw and only logs
- `exceljs` advisories (`archiver` → `glob` → `minimatch` → `brace-expansion`, and `uuid` v3/v5/v6),
  on the zip write path rather than the untrusted read path
- `/api/upload` returns 500 instead of 401 for a non-admin
- `supabase/fixes/2026-09-13_reconcile_cancel_drift.sql` is now moot — the drifted user lived in the
  abandoned project; the new pilot reconciles 0 mismatches. Kept as the pattern for future repairs
- Legacy `processing` / `shipped` still present in the redemption status type
- Stale receipt/OCR references remain in `src/app/admin/page.tsx`,
  `src/components/StatusBadge.tsx`, dashboard metrics routes, `TESTING_GUIDE.md`,
  `ADMIN_RBAC_TASKS.md`, and `GEMINI_API_KEY` in `.env.example`
- `database.types.ts` was hand-edited; `supabase gen types` has never been run against `013`–`020`.
  `verify-types.js` covers `Tables` only, not `Enums` / `Functions` / `CompositeTypes`
- A fresh Phase 2 database will `CREATE promo_codes` in `005` and `DROP` it in `015` — harmless noise
  kept so history stays honest; squash only when Phase 2 starts
- `/docs` is git-ignored, so `PHASE1_STATUS.md`, `PROMPTS.md`, and the demo assets are not in git

### Verified vs not verified (2026-09-14, new pilot `vltzkxmblmrvsmaookhl`)

| | |
|---|---|
| Parser self-check | ✅ 29/29 |
| Campaign overlap/validation rules | ✅ 18/18 |
| Demo file vs hand-computed points | ✅ 17/17 |
| Seed vs demo file, read from the live database | ✅ 19/19 |
| Schema on the pilot (`verify-schema.js`, 001–022) | ✅ 16/16 · `verify-types.js` 23 tables / 192 columns match |
| Batch money path (`e2e-batch-flow.js`: award, duplicate bill, void, re-award) | ✅ 23/23 |
| Points invariant (`e2e-points-invariant.js`: adjust, FIFO redeem past an expired lot, expire, cancel, overdraw) | ✅ 36/36 |
| `tsc --noEmit`, `npm run build` | ✅ |
| Production: every cron 401 unauthenticated, old crons 404 (`verify-cron-auth.js`) | ✅ 15/15 |
| Production: all 4 crons run once with the real secret (reconcile 8 users, 0 drift) | ✅ |
| Browser flow on the **old** pilot, 2026-09-13 (auth, sales reps, wrong/right week, 687, double-commit, balances, history, void, re-upload) | ✅ — found and fixed the previewed-duplicate 409 and the notes 500 |
| Browser flow on the **new** pilot with Sprint 6–7 code | ⏳ blocked on the admin password (see Open debt) |
| LINE push actually arriving on a phone (batch award, expiry, birthday) | ❌ not yet on the new pilot — no real LINE customer registered |

## Next recommended step

**1. Finish the browser rehearsal on the new pilot** (`wiki/13`): set the admin password (the
recreated auth user has never signed in), then click through batches → campaigns → user detail →
redemption cancel (now via `cancel_redemption`) → manual adjust (now creates a ledger lot). Register
one real LINE customer through LIFF so the push side can be seen on a phone.

**2. Demo prep:** reward images, shop phone, decide how the customer-side demo is shown (OTP works
for one test number only).

**3. Then Sprint 8** — Telegram/LINE group notify, redemption 4 statuses + QR, remove the legacy
`processing` / `shipped` values.
