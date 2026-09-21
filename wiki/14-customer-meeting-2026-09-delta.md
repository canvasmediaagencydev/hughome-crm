# 14 — Customer meeting, September 2026: what changed and what it touches

Source: the customer-facing handoff received 2026-09-21 — `HANDOFF_BRIEF_v2.md`,
`Hughome_Meeting_Sprint8_Update.html`, and the three older presentation files, all copied verbatim
into `wiki/meetings/2026-09-sprint8-customer-update/`. This page is the developer reading of that
material: every requested change mapped onto the code, the schema, and the locked decisions in
`wiki/09`, with the business questions that must be answered before the work starts.

**Read this before touching Sprint 9.** Several items reverse decisions the codebase currently
enforces (most seriously the point-expiry base date), and the customer's "Sprint 8" is not the
repository's Sprint 8 — see the naming note at the end.

Legend for the *Impact* column: **S** schema / migration · **A** API route or RPC · **U** admin UI ·
**C** customer LIFF UI · **X** Excel spec (`sales-columns.json`, gated by a hard rule) · **D** docs only.

---

## 1. New requirements

| # | Requirement (customer wording) | What exists today | Impact | Notes |
|---|---|---|---|---|
| N1 | **Customer ID (รหัสลูกค้า)** shown on every customer-facing and admin page, plus registration date; old-system IDs must carry over | `user_profiles.customer_code text` since `002`, editable at `PATCH /api/admin/users/:id`, searchable in the admin users list. **Not** auto-generated, **not** shown to the customer, **not** in reports or the batch preview | S A U C | Format is open (§4 Q1). Old-system IDs seen in the customer's mockup look like `HH-000423`, `AR-14577`, `20ขจ-319` — free text, so `customer_code` as-is can hold them. Auto-generation only for new registrations |
| N2 | **Dashboard date filter** — เดือนนี้ / 30 วัน / 90 วัน / custom — and a customer-configurable dashboard | Dashboard has no date filter; metrics routes still carry stale receipt references (`wiki/12` §6) | A U | Custom dashboard: the brief itself says three hard-coded presets are acceptable for MVP |
| N3 | **Batch rollback** — on any error, void the whole batch, points back to zero, re-upload | **Already built.** `void_batch` RPC (`wiki/04` "Void"), `POST /api/admin/batches/:id/void`, releases bill numbers, `voided_by` + reason recorded. `e2e-batch-flow.js` covers award → void → re-award | D | Customer wants the audit columns named `rolled_back_by / rolled_back_at / rollback_reason`; the schema already has `voided_by / voided_at / void_reason`. Naming only — do **not** add duplicate columns. Who may void is §4 Q3 |
| N4 | **Duplicate detection** — reject "750 + 750" for the same customer inside an upload | Duplicate **bill numbers** are rejected system-wide (`pbl_bill_no_active_idx`, parser pre-check). Same customer + same amount with *different* bill numbers is accepted today, by design — two real purchases of 750 on one day are legal | A | The key is undecided (§4 Q2). Whatever it is, it must be a **warning in the preview**, not a hard reject, unless the customer confirms hard reject: two identical bills on one day are a real retail pattern |
| N5 | **Campaign image, square only** (e.g. 500×500), reject anything else, JPG/PNG/WEBP | `point_campaigns` has `name, description, multiplier, starts_on, ends_on, is_active` — no image | S A U | New migration: `image_url text`, `image_width int`, `image_height int`; server-side dimension check before upload to a `campaign-images` bucket. File-size cap not decided |
| N6 | **Approver role** — Maker submits, Approver (the customer's approver) confirms, only then do points enter. No auto-approve | Today accounting `commit`s directly (`batches.commit`) and the manager spot-checks *afterwards* (`batches.review`, endpoint still unbuilt). Points enter at commit | S A U | This inserts a state between `previewed` and `committed`. See §3 for the state-machine change. The customer's "Approver" maps onto the existing `manager` role's `batches.review` permission, renamed and moved *before* commit — not a seventh role |

## 2. Cuts

| # | Cut | What exists today | Impact | Notes |
|---|---|---|---|---|
| C1 | **LINE Notify** to the team | Sprint 8 built team notify as **Telegram bot** or **LINE Messaging API push to a group** (`notification_channels.type IN ('telegram','line_group')`, `src/lib/team-notify.ts`). LINE Notify (the separate service that shut down in 2025) was never used | — | The customer's reason — "LINE API เดิมปิดบริการ" — describes LINE Notify, which this code does not use. The LINE *group push* still works technically. Whether it is still wanted is §4 Q6. Do not delete `line_group` until answered |
| C2 | **Telegram / SMS** for team notification | Telegram channel built in Sprint 8 (`023`, AES-256-GCM token, `NOTIFY_TOKEN_KEY`) | A U | Keep the code path, hide the UI option if confirmed. The `telegram` enum value stays (an applied migration is never edited) |
| C3 | **Bill number in the exported report** | No report export exists yet (Sprint 9). `MIGRATION_PLAN.md` §8.2 and `wiki/12` §5 record the *opposite* reversal: the manager spot-check needs bill numbers | A | Both are right, for two different reports. See §3 "Reports" |
| C4 | **HTML report + pie chart** | Not built | D | Excel only, via `exceljs` (already the only Excel library) |
| C5 | **"พนักงานขาย" → "Maker"** everywhere | Table `sales_reps`, role `sales_staff`, Excel header `พนักงานขาย`, admin page `/admin/sales-reps`, nav label | U X | UI labels and the guide sheet: free to change. The **Excel header** is in `sales-columns.json` and is a hard-rule change (§3). Table and role names stay — renaming a table for a label is not worth a migration |
| C6 | Receipt photo / OCR (re-confirmed) | Already deleted (Sprint 3) | — | Nothing to do |

## 3. Changes that alter enforced behaviour

These are the ones that matter. Each one currently has a locked decision, a constraint, or a hard
rule behind it.

### Point expiry: 365 days from **upload date**, not purchase date

Customer: *"อายุแต้ม 365 วัน นับจากวันที่อัปโหลดเข้า wallet ไม่ใช่วันที่ซื้อ … Upload 100 รายการพร้อมกัน =
ทุกรายการหมดอายุอีก 365 วันจากวันนั้น"*.

Code today (`wiki/09` locked decision, migrations `017`/`020`): `earned_month` is derived from each
row's **purchase date**, and `expires_at` = last day of that month + 365 days. The reason recorded
was that an accounting delay across a month boundary must not grant an extra month of validity —
which is exactly what the customer now asks for.

This is a business decision that reverses a locked one, so under the hard rules it stops the work
until the customer confirms in writing. If confirmed:

- new migration: `award_points_from_batch` derives `earned_month` / `expires_at` from `now()` (commit
  time, or approval time once N6 exists) instead of `purchase_date`; the column stays, only its source
  changes; existing lots are **not** re-dated
- the guide sheet line "วันที่ซื้อ ใช้กำหนดเดือนที่ได้แต้มและวันหมดอายุแต้ม" becomes wrong and must be
  regenerated (`build-template.js`)
- `wiki/04` "Points formula", `wiki/03` ledger section, `CLAUDE.md` §2 objective 5, and the locked
  decision row in `wiki/09` all need the new wording
- the "daily vs monthly expiry cron" note in `wiki/07` becomes more important, not less: lots will
  now expire on arbitrary days of the month

`purchase_date` still drives the **campaign multiplier** (locked, anti-fraud) and the week-range check.
Nothing about that changes.

### Batch state machine: an approval step before points enter

Today: `draft → previewed → committed` (`→ voided`). Points move at `commit`.

Requested: `previewed → pending_approval → committed`. Accounting (`batches.commit` today) becomes the
Maker's submitter; the Approver confirms. Points move at approval.

Smallest honest implementation:

- migration: add `pending_approval` to `batch_status`; add `submitted_by / submitted_at` to
  `point_batches` (`approved_by / approved_at` are what `committed_by / committed_at` already are — do
  not duplicate them)
- `POST /api/admin/batches/:id/submit` (needs `batches.upload`), moves `previewed → pending_approval`,
  fires a team notification (§ N/C7 below)
- `POST /api/admin/batches/:id/commit` now requires `pending_approval` **and** a new permission
  `batches.approve`; `manager` and `super_admin` get it; `accounting` loses `batches.commit`
- `void` must also work from `pending_approval` (reject before any points moved — cheap, no ledger)
- the customer's "ไม่ auto-approve" means there is no path from `previewed` straight to `committed`

The leftover Sprint 5 item `POST /:id/review` (post-commit spot-check) is superseded by this, unless the
customer still wants a spot-check *after* approval as well — ask.

### Team notification: **email + in-app bell**, replacing push to a chat app

Requested triggers: batch pending approval, new redemption, scheduled digests (daily / every Monday)
for points about to expire.

Nothing of this exists. Sprint 8's `notification_channels` is per-channel (Telegram / LINE group), not
per-admin. Needed:

- migration: `admin_notifications (id, recipient_admin_id → admin_users, type, title, body, action_url,
  is_read, created_at)` and `notification_schedules (id, cron_pattern, trigger_type, is_active)` — the
  brief's own draft schema is usable as-is, with RLS to the recipient
- an email provider. None is configured. The brief lists SendGrid / Resend / SES; the customer also
  wants a **dedicated sender identity** for Hug Home (see "Infrastructure" below). New env var, no
  default, validated at boot like everything else
- `GET /api/admin/notifications/inbox`, `PATCH .../:id/read`, a bell in the admin header with an unread
  count; a fifth cron for the digests (gated by `verifyCronRequest` like the other four)
- `src/lib/team-notify.ts` grows an `email` + `in_app` fan-out next to the existing two; the existing
  redemption trigger stays

The existing admin routes at `/api/admin/notifications/*` manage *channels*; the inbox needs a
different path to avoid a collision.

### Excel spec: add `รหัสลูกค้า`, rename `พนักงานขาย` → `Maker`

Requested mandatory columns: รหัสลูกค้า · เบอร์โทร · ยอดซื้อ · ยอดลดหนี้ (ชื่อ optional). The brief's
own draft schema **omits `วันที่ซื้อ`** — that is an error in the brief: the multiplier lookup and the
week-range check both need it, and the customer's own mock template (`Hughome_Sales_Template_
MockData50.xlsx`, 50 rows, 1–26 July 2026) still has it in column A. Keep it.

Proposed v2 spec (9 columns): `รหัสลูกค้า* · วันที่ซื้อ* · เลขที่บิล* · เบอร์โทรลูกค้า* · ชื่อลูกค้า ·
ยอดซื้อ* · ยอดลดหนี้ · Maker* · หมายเหตุ`.

Two things to settle first:

1. Changing `sales-columns.json` is a hard rule (`CLAUDE.md` §4): sheets already in circulation
   break. The customer is starting a trial, so the window to change it is *now*, before the first
   real upload — but it still needs an explicit go-ahead.
2. **Matching key.** Today the parser matches a row to a customer by **phone only** and reports
   unmatched phones without creating anyone. If `รหัสลูกค้า` becomes mandatory, decide what wins when
   code and phone disagree. Recommended: match on phone as today, treat the code as a cross-check
   and flag a mismatch in the preview. Making the code the primary key would reintroduce the "ghost
   account from a typo" risk the phone rule exists to prevent.

`ยอดลดหนี้` mandatory vs optional: the brief says mandatory; the customer's own template says optional
(blank = 0). Optional is the better UX and is what the parser does today. Confirm.

### Reports: Excel, per customer, no bill number, phones without dashes

Two different reports are being conflated:

| Report | Audience | Bill numbers | Grouping |
|---|---|---|---|
| **Customer export** (this meeting) | the customer's marketing side, for marketing / follow-up | **no** | one row per customer: code, name, phone (10 digits, no dashes), points, tier, tags, registration date |
| **Weekly batch report** (`MIGRATION_PLAN.md` §8.2, `wiki/12` §5, Sprint 9 plan) | manager / approver, to check against paper bills | **yes** | one row per bill, with salesperson |

Both are Sprint 9. The reversal recorded in `wiki/12` §5 stands for the second one. Phone format:
`src/lib/phone.ts` already stores the local 10-digit form, so the export just must not reformat it.

### Tags: free-form for one month, then lock

`tags` and `user_tags` exist since `002`. Admin UI for creating tags is stale (receipt-era dashboard).
Requested: any admin can create a tag (name + colour), optional at onboarding, review the format after
a month. Nothing schema-level; UI in Sprint 9.

### Infrastructure: dedicated Supabase project and sender domain

The pilot already runs on its own Supabase project (`vltzkxmblmrvsmaookhl`, see `wiki/07`), which
satisfies "แยก DB". The email sender identity (`@hughome.co` or similar) is new and belongs with the
email-provider decision above. Phase 2 migration of the ~700 real customers is unchanged.

## 4. Open questions — the work stops on these

Numbered so they can be answered by number.

| # | Question | Blocks |
|---|---|---|
| Q1 | `customer_code` format for **new** customers: `HUG-YYYYMM-####` (brief) or continue the old system's scheme? Old IDs are imported as-is either way | N1 |
| Q2 | Duplicate-detection key: phone + date + net amount? Include bill number (then it is already covered)? Warning or hard reject? | N4 |
| Q3 | Who may void / roll back: Approver only, or also `super_admin`? Also from `pending_approval`? | N3, N6 |
| Q4 | **Confirm in writing:** expiry base = upload/approval date, superseding the purchase-date rule. State the consequence: a late upload extends validity · **✅ ยืนยัน 2026-09-21** (relayed by the project owner) → migration `025`, `wiki/04` "Points formula" | §3 expiry |
| Q5 | Excel v2: approve the spec change now (before any real sheet is issued)? `ยอดลดหนี้` optional? Code-vs-phone mismatch handling? · **✅ อนุมัติ 2026-09-21** → `sales-columns.json` v2 (9 columns), `ยอดลดหนี้` kept optional, mismatch = preview warning with the phone as key (the sub-points were not answered separately; these are the recommended defaults from §3 and can be flipped) | §3 Excel |
| Q6 | Is LINE **group** push (Messaging API, still operational) to be removed, or only LINE Notify (never used)? | C1 |
| Q7 | Notify the **customer** on points-in: on or off? (`NOTIFICATIONS_ENABLED` is `false` on production today — every customer push is already a no-op) | Sprint 7 pushes |
| Q8 | Points-threshold alert: which number, and who receives it (customer or team)? | digests |
| Q9 | 300 / 500-baht campaign rule: a minimum spend to qualify for a multiplier, or something else? | campaigns |
| Q10 | The numbers 185 / 184 / 183 / 18.3 / 7.9 from the meeting — what are they? Not usable as requirements until named | — |
| Q11 | Email provider and sender domain; Thai or English templates | §3 notify |
| Q12 | Does the manager still want a post-approval spot-check (`batches.review`), or does approval replace it? | Sprint 5 leftover |

## 5. What this does to the sprint plan

`wiki/09` "Remaining" is updated to match. Summary:

- **Sprint 9 (customer trial, Android focus)** — N1 display + import, N3 naming in UI, N4 preview
  warning (once Q2 is answered), N6 approval step, `พนักงานขาย → Maker` labels, customer 5-tab nav,
  customer export (Excel), dashboard date filter, Android layout check.
- **Sprint 10** — email + bell notifications and digests, campaign image, weekly batch report,
  tags UI, expiry-base migration if Q4 confirms.
- **Sprint 11** — custom dashboard widgets, bell polish, Phase 2 data migration plan.

**Update 2026-09-21 (evening):** Sprint 9R part A is built and Q4/Q5 (part B) are included — migrations
`024` (approval flow) and `025` (expiry base) are written but **not applied**. See `wiki/09` "Sprint 9R".
Q1, Q2, Q3, Q6–Q12 remain open; the code takes the defaults named in §4.

## 6. Naming note: two different "Sprint 8"s

The customer's deck counts sprints as 1 สาขา · 2 Roles · 3 Security · 4 Excel Spec · 5 Promo Code ·
6 เมนู Admin · 7 Point Engine · 8 Coupon Redeem · 9 Confirm+Rollback+Expiry+Notify · 10 QR+Reports,
and reports "80 %, 8/10 done".

The repository counts 0–8, where 7 = expiry + cron + LINE push and 8 = team notify + 4-status
redemptions + pickup QR — both already deployed as `784603a`. So the customer's "Sprint 9: rollback,
expiry, notify" is mostly done, and their "Sprint 10: QR scan" is done. What is genuinely new is in
§1 and §3 of this page. When talking to the customer, use their numbering; in this repository, use
ours.

## 7. Documents in `wiki/meetings/2026-09-sprint8-customer-update/`

| File | Status |
|---|---|
| `HANDOFF_BRIEF_v2.md` | The brief this page is derived from. Its Excel schema is wrong (drops `วันที่ซื้อ`); its Part 1.4 lists the new bottom nav under "cuts" by mistake; it calls void "rollback" |
| `Hughome_Meeting_Sprint8_Update.html` | The customer-facing summary, 4 tabs. Same content as the brief's Part 0 |
| `Hughome_Workflow_Confirmation.html` | **Superseded.** The signed 9-step scope from the previous meeting. Steps 5, 7, 9 and the Excel columns in step 3 no longer match. A v2 must be produced before the customer signs anything else |
| `Hughome_Meeting_Pack.html` | **Superseded.** Previous meeting's add/cut/adjust list. Its "Dashboard รวม 2 สาขา" contradicts the one-tenant-per-instance architecture (`CLAUDE.md` §2) — cross-branch view stays a non-goal |
| `Hughome_Interactive_Mockup_v7.html` | UI mockup shown to the customer. Still shows receipt review, bulk approve, LINE push tokens, `พนักงานขาย`, fixed B2B/B2C tags, and old-format customer codes. A v8 is owed; not a code artefact |

The customer's mock template `Hughome_Sales_Template_MockData50.xlsx` was **not** copied in: its 50
rows and rep `S029` are the same mock set that `wiki/09` "Demo data — resolved 2026-08-31" removed
from the pilot because it broke the 10-row demo file. Regenerate any v2 template from
`scripts/generate-sales-template.js` once the spec is approved.
