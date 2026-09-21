# 09 — Status & roadmap

Everything on this page is drawn from the codebase, `MIGRATION_PLAN.md`, `docs/PHASE1_STATUS.md`,
`docs/PROMPTS.md`, and verification scripts that were actually run. Claims that were *not* verified
are marked as such.

## Current status

| | |
|---|---|
| Branch / deploy | `pilot-phase1` → https://pilot-phase1.vercel.app, commit `784603a` (Sprint 6–8 pushed 2026-09-14) |
| Supabase | pilot `vltzkxmblmrvsmaookhl`, `tenant_code = pilot` |
| Migrations | `001`–`026` applied (`024`–`026` on 2026-09-21 through the SQL Editor) |
| Sprints complete | 0, 1, 2, 2.1, 3, 3.1, pre-4, 4, 5 (partial), 6, 7, 8 · **9R code + DB complete 2026-09-21** (uncommitted, not deployed) |
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

### Sprint 8 — team notify + 4-status redemptions + QR (code done 2026-09-14)
Migration `023` (applied 2026-09-14, `verify-schema.js` 18/18, `e2e-points-invariant.js` 36/36 on v3): `generate_pickup_code()`, `redeem_reward` v3 issues an 8-char pickup
code inside the redeem transaction, unique partial index on `redemptions.pickup_code`,
`notification_channels.last_sent_at` / `updated_at`. The `redemption_status` enum already had the five
target values since `001`; the legacy `processing` / `shipped` strings are gone from the TypeScript side
(`src/lib/redemption-status.ts` is the single source: labels, `NEXT_STATUS`, `CANCELLABLE`).

Routes: `PATCH /api/admin/redemptions/:id/status` (one step forward only, `.eq('status', from)` guard →
409 on a race; `approved`/`ready` need `redemptions.process`, `delivered` needs `redemptions.deliver`),
`GET /api/admin/redemptions/lookup?code=` (QR scan), `GET/POST /api/admin/notifications`,
`PATCH/DELETE /:id`, `POST /:id/test`. The old `/:id/complete` route is deleted. Cancel still goes through
`cancel_redemption` (021) and now returns 401 instead of 500 unauthenticated.

Team notify: `src/lib/team-notify.ts` — Telegram Bot API `sendMessage` (token AES-256-GCM in the DB,
key `NOTIFY_TOKEN_KEY`, `GET` masks to `123456789:••••••••xxxx`) or LINE Messaging API push to a
`groupId` with the OA token. Fired from `POST /api/rewards/redeem` via Next `after()` so the customer
response is never delayed; failures land in `notification_channels.last_error`, never fail the redemption.
5 s timeout per channel. Message: tenant, customer name, phone, reward ×qty, points, pickup code, admin link.

UI: `/admin/redemptions` rewritten (5 status tabs, step buttons, cancel with reason, pickup code shown,
delivered/approved timestamps), `/admin/redemptions/scan` (opens from the QR URL, or type the code;
delivers only from `ready`, offers the next step otherwise), `/admin/notifications` (add / toggle / re-key /
delete / test), nav item "แจ้งเตือนทีม" (`notifications.manage`), `/admin/login?next=` round-trip so a
scanned QR lands back on the scan page after login. Customer: QR dialog after redeem and from the history
tab (`src/components/PickupQrDialog.tsx`), status hint under each redemption.

Offline self-check `scripts/test-sprint8-rules.mjs`: **22/22**. `tsc` + `npm run build` clean. Deployed as
`784603a` and exercised on **production** through HTTP with `scripts/e2e-sprint8-http.js`: **50/51** —
401 on every new route, pickup code format, lookup (lower-case ok / 0 rejected / unknown 404), every
illegal transition 409, `cancelled` via status 400, approve→ready→deliver with actor columns, cancel on
delivered refused, cancel at approved and at ready refunds to the same lot + stock + refund row,
invariant `balance == SUM(ledger)` after every step, channel validation, token masking, PATCH/DELETE. The
one failure was a transient 403 from the Supabase auth flake (re-run 5× → 404 as designed). Not covered:
the browser UI and `POST /api/rewards/redeem` → `notifyTeam` (needs a LIFF session) — `wiki/13` §7b.

**Found while testing:** `NOTIFICATIONS_ENABLED` on Vercel production is `false` — a LINE-group test push to a
garbage groupId returned 200, which only happens when `pushMessage` skips. LINE push on prod has been a no-op
(batch award, expiry, birthday, and now team notify). Set it to `true` before the demo if pushes should arrive.

### Sprint 9R — customer-trial build (code done 2026-09-21 · 024/025 applied the same day)

Built from `docs/PROMPTS.md` "Sprint 9R" after the 2026-09-21 meeting (`wiki/14`). The customer answered
**Q4 = confirmed** and **Q5 = approved** on the same day, so part B for those two is included.

- **Migration `024` (approval flow):** `batch_status` gains `pending_approval`; `point_batches.submitted_by /
  submitted_at` (+ CHECK pair); permission `batches.approve` → super_admin + manager; `batches.commit`
  removed from accounting; `award_points_from_batch` v4 accepts only `pending_approval` and awards rows
  with status `valid` **or** `duplicate_amount`; `void_batch` v3 also closes a `pending_approval` batch
  (reject, no ledger). Rollback file restores 020/017 bodies.
- **Migration `025` (Q4):** `award_points_from_batch` v5 — `expires_at = approval date (Bangkok) + 365`,
  `earned_month = approval month`. Old lots untouched. Rollback restores v4.
- **Routes:** `POST /api/admin/batches/:id/submit` (upload perm, status guard, team notify
  `batch.submitted` after the response), `POST /:id/commit` now needs `batches.approve` and answers 409
  "ต้องส่งให้ผู้อนุมัติก่อน" on `previewed`, `POST /:id/void` from `pending_approval` too,
  `GET /api/admin/batches/:id` (rows for the approver — the Sprint 5 leftover), list returns
  `submitted_by_name`. Upload: `pending_approval` twin → 409; customer-code cross-check lookup;
  `valid_rows` = awardable rows.
- **Excel spec v2 (Q5):** `sales-columns.json` — 9 columns, `รหัสลูกค้า` first, header `Maker`;
  parser: `customer_code`, `warnings[]`, `duplicate_of_row`, status `duplicate_amount`,
  `duplicateAmountPolicy` flag (warn default), `customerCodeByUserId` cross-check (phone stays the key);
  template guide sheet rewritten (approval steps, expiry from approval date, Maker); demo file and
  `docs/Hughome_Sales_Staff_Template.xlsx` regenerated. `test-parse-sales-batch.js` **42/42**,
  `verify-demo-batch.js` **17/17**.
- **UI:** `/admin/batches` rewritten — status filter tabs (รอส่ง / รอผู้อนุมัติ / แต้มเข้าแล้ว / ยกเลิก),
  buttons by permission (ส่งให้ผู้อนุมัติ · อนุมัติ (แต้มเข้า) · ปฏิเสธ · ยกเลิกทั้งชุด (Rollback)), preview
  reopenable from history (fixes the "previewed batch has no button after reload" debt), yellow
  duplicate/warning rows with counts, `voided_by_name` rendered, per-batch Excel report button.
  `/admin/notifications` gained per-channel event checkboxes (`batch.submitted`).
- **Labels:** every "พนักงานขาย" in `src/` → "Maker" (nav, sales-reps page, toasts, API errors, guide sheet);
  table/role/JSON key unchanged.
- **Customer ID:** `customer_code` + registration date (พ.ศ.) on `/dashboard` header, `/profile` card,
  admin user card + detail modal, batch preview column, both Excel reports. `null` renders
  "ยังไม่กำหนดรหัส"; nothing is generated (Q1 open). Login + refresh APIs return both fields.
- **Reports:** `/api/admin/reports/users/excel` rewritten via `src/lib/excel/build-reports.js` — all
  onboarded customers, one row each, no bill column, phone as 10-digit text, code, registration date,
  type, balance, next-expiring lot + date, net purchases + bill count in range, tags; file
  `customers_<from>_<to>.xlsx`. New `GET /api/admin/reports/batches/:id/excel` (one row per bill, bill
  number + Maker + branch, totals row, metadata sheet). `scripts/build-sample-reports.js` writes
  `docs/demo/sample_customers_export.xlsx` + `sample_batch_report.xlsx` from demo data (or `--from-db`
  read-only with fake names).
- **Dashboard:** `/admin` presets เดือนนี้ (default) · 30 วัน · 90 วัน · กำหนดเอง → `?from=&to=` on
  `/api/admin/dashboard/metrics` and `/all` (shared `src/lib/dashboard-metrics.ts`). Metrics now:
  pending-approval batches, points issued / redeemed in range, new customers in range, batches
  approved in range, totals. Receipt/OCR metric names removed from the dashboard routes, hook, tiles,
  `UsageStatistics`.
- **Customer side:** `BottomNavigation` 5 tabs (หน้าหลัก · แลกรางวัล · โทรร้าน · Facebook · โปรไฟล์),
  new `/call` (tel: + LINE OA from `TENANT`) and `/facebook` (from `TENANT.facebookUrl`), `/history` link
  gone, `viewportFit: cover`, bottom padding on every tab page, profile header tightened for 640 px.
  Screenshots at 360×640 + 412×915 in `docs/android-check/` (git-ignored).
- **Tags:** existing `/admin/tags` CRUD + user-detail attach/detach kept; delete confirm now names the
  number of customers wearing the tag.
- **Scripts:** `e2e-batch-flow.js` rewritten for submit → approve → reject → rollback and the 025 expiry
  dates (**needs 024/025 applied to run**); `build-demo-batch.js`, `verify-demo-ready.js`,
  `generate-sales-template.js` follow spec v2.
- `tsc` + `npm run build` clean. After apply: `verify-schema.js` **22/22**, `verify-types.js` clean (hand-patched
  types match the live DB), `e2e-batch-flow.js` **35/35** (RPC refuses `previewed`, submit guard, award 90 = valid 45 +
  duplicate 45, `expires_at` = approval day + 365, rollback, reject without ledger, invariant),
  `e2e-points-invariant.js` **36/36**.

### Sprint 10 part 1 — email notify, code import, Rollback scope (2026-09-21, same evening)

Answers received from the customer (via the project owner) after 9R shipped: Q1 numeric codes from the old
system · Q2 duplicate = warning · Q3 Rollback = super_admin only · Q6 email instead of Telegram/LINE group ·
Q7 no customer push (weekly cut-off) · Q11 Resend, internal test mailbox = the agency address.

- **Migration `026`** (applied): `notification_channels.type` CHECK gains `'email'`; `batches.void` removed
  from `manager`. `verify-schema.js` **23/23**.
- **Email channel:** `src/lib/team-notify.ts` `sendEmail` → Resend REST (`RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`,
  both optional at boot, throw on use). `CREATABLE_CHANNEL_TYPES = ['email']` — API and `/admin/notifications`
  create email only; legacy Telegram/LINE-group rows still list, test, deliver, delete. One internal test
  channel (`canvasmediaagency@gmail.com`, both events) inserted in the pilot DB.
- **Void route** checks the batch first: `pending_approval` reject needs `batches.approve`, `committed`
  rollback needs `batches.void`. UI buttons follow.
- **Customer-code import:** `POST /api/admin/users/import-codes` (xlsx A=code B=phone, dry-run by default,
  `apply=1`, `overwrite=1`), page `/admin/customer-codes`, nav "นำเข้ารหัสลูกค้า" (`users.edit`).
  `src/lib/customer-code.ts` — digits accepted, old `AR-10297` / `50ลส-1030` shapes still pass; the
  manual PATCH uses the same rule.
- Pilot DB clean-up done (rep `S99`, previewed demo batch) → `verify-demo-ready.js` **19/19** (voided demo
  batches no longer count). Test admin with `accounting` + `manager` roles created for the internal run.

## Remaining

> **2026-09-21 — the customer's latest meeting changed the plan below.** The full delta, its code
> impact, and the 12 blocking questions are in `wiki/14-customer-meeting-2026-09-delta.md`. The rows
> here are the *updated* plan; items marked ⚠️ cannot start until the numbered question in `wiki/14`
> §4 is answered.
> The work prompt for the next build is `docs/PROMPTS.md` → "Sprint 9R" (git-ignored, on the
> working machine); it splits the list into part A (start now) and part B (after the questions).

| Sprint | Work |
|---|---|
| 9R / 10 (finish) | set `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` on Vercel and `.env.local` once the Resend account exists · SMS provider for OTP (blocker for real sign-ups) · click `wiki/13` §10–§11 on production with the test admin · fill `NEXT_PUBLIC_TENANT_PHONE` / `NEXT_PUBLIC_TENANT_FB_URL` · reward images · `supabase gen types` once logged in (types already match) |
| 5 (leftover) | `POST /:id/review` **on hold** — approval before points now exists; Q12 decides whether a post-approval spot-check is still wanted. `GET /:id` is done (9R) |
| 8 (wrap-up) | set `NOTIFY_TOKEN_KEY` on Vercel + `.env.local` · set `NOTIFICATIONS_ENABLED=true` on prod (⚠️ Q7 first — the customer may not want customer pushes at all) · click through `wiki/13` §7b |
| still waiting on a question | ⚠️ **Q8** points-threshold alert · ⚠️ **Q9** 300/500-baht rule · ⚠️ **Q10** meeting numbers · ⚠️ **Q11** sender domain (who owns the shop domain's DNS) · ⚠️ **Q12** post-approval spot-check |
| 10 (rest) | in-app bell (`admin_notifications`) + digests (`notification_schedules`, fifth cron) · dedicated sender domain (Q11) · **campaign image** square-only upload · Thai wording for point-history strings |
| 11 | custom dashboard widgets · bell polish (bulk mark-read, filters) · Phase 2 data migration plan (real branch, ~700 customers, old IDs) |

## Locked decisions

Each of these is a decision that was made explicitly and should not be revisited without a reason.

| Decision | Why | Where |
|---|---|---|
| Promo code column removed; multipliers are back-office date ranges | project owner: "ป้องกันการทุจริต" — the person keying amounts must not choose the multiplier · **re-confirmed by the customer 2026-09-21** (their template guide says the same) | migration 014, `sales-columns.json` |
| **Reversed 2026-09-21 (Q4 confirmed):** points expire 365 days from the **approval date**, `earned_month` = approval month | the customer wants "อัปโหลด 100 รายการพร้อมกัน = หมดอายุวันเดียวกัน" and accepted that a late upload extends validity. `purchase_date` still drives the multiplier and the week check. Lots issued under the old rule keep their dates | migration 025 (replaces the 017/020 rule) |
| Points enter only after an approver clicks — no path from `previewed` to `committed` | the customer's Maker/Approver split; the people who key amounts must not release points | migration 024, `batches.approve` |
| Excel spec v2 with `รหัสลูกค้า` as column A, header `Maker` | Q5 approved 2026-09-21 before any real sheet was issued; the phone stays the matching key and the code is a cross-check warning, so a typo cannot redirect points | `sales-columns.json` v2 |
| Bill numbers unique system-wide, except in voided batches | one bill earns points once; voiding releases the number for a corrected re-upload · the customer's "batch rollback" (2026-09-21) **is** this void; no second mechanism | `pbl_bill_no_active_idx` |
| Sales staff have no login; accounting uploads | `uploaded_by` references `admin_users`, whose `auth_user_id` is UNIQUE NOT NULL — a login per salesperson was out of scope · **re-confirmed 2026-09-21**: "ผู้ขายไม่มีสิทธิ์แตะหลังบ้าน"; the label becomes "Maker" but the table and role names stay | `sales_reps` table |
| Campaign date ranges may not overlap | one multiplier per day, so selection is deterministic and needs no tie-break rule | `point_campaigns_no_overlap` |
| Four separate audit actors per batch | uploader, committer, reviewer, voider can all be different people | migration 019 |
| `award_points_from_batch` 1-arg version dropped, not overloaded | an overload is how someone accidentally calls the version that records nobody | migration 020 |
| `xlsx` removed, `exceljs` adopted | prototype pollution + ReDoS make `xlsx` unusable for parsing uploaded files | `package.json` |
| Unmatched phones are reported, never auto-created | a typo would otherwise mint a ghost account that real points flow into | parser |
| Table named `sales_reps`, not `sales_staff` | `sales_staff` is already an `admin_roles.name` value | migration 013 |
| `seed_demo_data.sql` lives outside the migration path | `supabase db push` must never load demo customers into a real branch | `supabase/seed/` |

## Open debt

### Operational
- Admin login on the new pilot works (password set 2026-09-14, not in the repo). The app still has no
  password-reset page, so a lost password needs `auth.admin.updateUserById` (service role)
- **Supabase Auth on the pilot is flaky** — `GET /auth/v1/user` returned 504 twice in 23 s during the
  2026-09-14 rehearsal (the project is on the free tier). Every admin API goes through
  `requirePermission` → `auth.getUser()`, so one slow answer becomes a 500 on the route and, via
  `useAdminAuth` (`/api/admin/me`, retry 1), a bounce to `/admin/login` while still signed in.
  Consider a paid plan before the customer demo
- **Test leftovers on the pilot from the 2026-09-14 rehearsal, not yet removed:** one `point_batches`
  row in status `previewed` (re-upload after void, step 6.6) and sales rep `S99` (inactive).
  Clean-up SQL is in `wiki/13` §9; `verify-demo-ready.js` must return 19/19 afterwards
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
- `/api/upload`, `/api/admin/users`, `/api/admin/redemptions` return 500 instead of 401 unauthenticated —
  their catch-all does not special-case `Unauthorized` the way `batches/route.ts` does. The same
  catch-all is what turned the Supabase Auth 504 into "Failed to adjust points" (500) on
  `users/[id]/points`
- **Found in the 2026-09-14 browser rehearsal (`wiki/13`), none money-related:**
  - ~~a `previewed` batch has no commit/void action in the history table after a page reload~~ fixed 9R (`GET /:id` + "เปิด preview")
  - ~~batch history shows the void reason but not who voided~~ fixed 9R
  - the commit toast says "แจ้ง LINE n คน" for every attempted push, including failures
    (`notifyPointChange` swallows errors); on demo customers with fake LINE ids all 8 pushes failed
  - wrong password on `/admin/login` shows the raw Supabase text "Invalid login credentials"
  - upload with an empty week is not blocked client-side; the server reply is developer-worded
  - point history strings are English ("Batch award · bill …", "Batch voided: …")
- `supabase/fixes/2026-09-13_reconcile_cancel_drift.sql` is now moot — the drifted user lived in the
  abandoned project; the new pilot reconciles 0 mismatches. Kept as the pattern for future repairs
- `notifications.manage` is held by `super_admin` and `manager` only (012); `reward_manager` cannot see
  `/admin/notifications` — fine for the pilot, revisit if the store wants reward staff to manage the group
- Stale receipt/OCR references: dashboard routes / hook / tiles / `StatusBadge` cleaned in 9R. Still in
  `src/app/api/admin/analytics/route.ts` (`receipts` field name), `src/app/admin/roles/page.tsx`,
  `src/lib/line-messaging.ts` (`receipt_approved` kind), `TESTING_GUIDE.md`, `ADMIN_RBAC_TASKS.md`,
  `GEMINI_API_KEY` in `.env.example`
- `verify-demo-ready.js` currently 17/19 on the pilot because of the two rehearsal leftovers above
  (rep `S99`, one `previewed` demo batch) — not a code problem; clean-up SQL in `wiki/13` §9
- Email delivery is untested end-to-end until `RESEND_API_KEY` / `NOTIFY_EMAIL_FROM` are set; the test
  channel will show `last_error` "RESEND_API_KEY ไม่ได้ตั้งค่า" until then
- `TENANT.phone` / `TENANT.facebookUrl` are still placeholders in `.env.local` and on Vercel — `/call`
  and `/facebook` show them verbatim
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
| Browser flow on the **new** pilot with Sprint 6–7 code, 2026-09-14 (`wiki/13` §1–6, 8.3: auth redirect, sales reps, template, wrong/right week, 687, double-commit, balances, history, void → 0, re-upload after void, manual ±50 via RPC) | ✅ money path clean — findings listed under Open debt · full log in `docs/TEST_RUN_2026-09-14.md` (git-ignored) |
| Customer side on the new pilot (`wiki/13` §7, and §8.1–8.2 which need a redemption) | ❌ needs a phone + LIFF + the OTP test number |
| LINE push actually arriving on a phone (batch award, expiry, birthday) | ❌ **cannot arrive** — `NOTIFICATIONS_ENABLED=false` on Vercel production (found 2026-09-14) |
| Sprint 8 admin API on production (`e2e-sprint8-http.js`) | ✅ 50/51 (1 transient auth 403) |

## Next recommended step

**1. Finish the customer side of the rehearsal** (`wiki/13` §7 + §8.1–8.2, needs a phone): register
one real LINE customer through LIFF, redeem, cancel from `/admin/redemptions`, and confirm the push
arrives. Then run the clean-up SQL in `wiki/13` §9 and re-check `verify-demo-ready.js` 19/19.

**1b. Before the demo, fix the two rehearsal findings that hurt a live demo:** the Supabase Auth
504 → 500/bounce-to-login (map auth failures to 503 with a Thai "try again" message, and consider a
paid Supabase plan), and the `previewed` batch with no commit button after reload.

**2. Demo prep:** reward images, shop phone, decide how the customer-side demo is shown (OTP works
for one test number only).

**3. Sprint 8 wrap-up (code written, `023` applied):** add `NOTIFY_TOKEN_KEY` (64 hex) to Vercel and
`.env.local`, deploy, then click `wiki/13` §7b with a real Telegram group.

**4. Get the `wiki/14` §4 questions answered** — Q4 (expiry base), Q5 (Excel v2) and Q3/Q12 (approval
step) change migrations and the Excel spec, so they must be settled before any Sprint 9 code that
touches batches. Q1 and Q2 can be answered in parallel.

**5. Then Sprint 9** as listed under Remaining — the customer-visible items first (Customer ID,
Maker label, approval step, 5-tab nav), because the trial starts with the customer's approver and the customer's second tester on Android.
