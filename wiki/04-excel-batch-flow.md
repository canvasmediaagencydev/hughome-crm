# 04 — Excel batch flow

The flow the whole product exists to support.

## Roles in the flow

| Who | Does what | Has a login? |
|---|---|---|
| Maker (`sales_reps`, label changed from "พนักงานขาย" 2026-09-21) | fills the sheet daily, sends the file to accounting weekly | **No** |
| Accounting (`accounting`) | uploads, reviews the preview, **submits to the approver** (`batches.upload`) | Yes |
| Approver (`manager`, `batches.approve`) | reviews the pending batch, approves (points enter) or rejects · voids a bad batch after the fact | Yes |

Since Sprint 9R (migration `024`) accounting can no longer release points on its own — `batches.commit`
was removed from the `accounting` role and the commit route requires `batches.approve`.

Sales staff having no login is a decided position, not an oversight. `point_batches.uploaded_by`
references `admin_users`, whose `auth_user_id` is UNIQUE NOT NULL, so letting salespeople upload
would mean creating a Supabase Auth account for each of them — out of scope for Phase 1.

If that changes later, the upgrade path is already open: give them `batches.upload` but **not**
`batches.commit`. They could then upload and see their own preview while points still only enter
when accounting confirms. This works because `uploaded_by` and `committed_by` are already separate
columns.

## The column spec

Single source of truth: **`src/lib/excel/sales-columns.json`**. Both the plain-JS template builder
and the TypeScript parser read that file. Never hardcode a header string anywhere else.

Sheet `ยอดซื้อ`, header on row 1, **9 columns (spec v2, Q5 approved 2026-09-21)**:

| # | Column | Required | Notes |
|---|---|:--:|---|
| A | `รหัสลูกค้า` | ✅ (guide) | cross-check only — **the phone is still the matching key**. Blank + customer has no code = silent; any disagreement (blank vs code, code vs different code, code vs none in system) = row **warning**, never a reject. Compared case-insensitively |
| B | `วันที่ซื้อ` | ✅ | date cell, or `dd/mm/yyyy` text. Buddhist years converted automatically (year > 2400 → −543). Must fall inside the uploaded week. Drives the **campaign multiplier** — no longer the expiry date (see "Points formula") |
| C | `เลขที่บิล` | ✅ | ≤ 64 characters. Unique across the whole system except in voided batches |
| D | `เบอร์โทรลูกค้า` | ✅ | 10 digits. `8xx` auto-corrected to `08xx`. Must start `0[689]` |
| E | `ชื่อลูกค้า` | | for eyeballing only |
| F | `ยอดซื้อ` | ✅ | number > 0 |
| G | `ยอดลดหนี้` | | blank = 0, must not exceed the purchase amount (kept optional — the customer's own template says so) |
| H | `Maker` | ✅ | **dropdown** of active `sales_reps`, label `CODE · Name`. JSON key is still `sales_rep` |
| I | `หมายเหตุ` | | internal, never shown to the customer |

v1 (8 columns, header `พนักงานขาย`) files are rejected by the header check — the pilot had not issued a
real sheet before the change.

Sheet 2 is `คำแนะนำ` (instructions) and sheet 3 is `_staff`, a `veryHidden` sheet holding the
dropdown source. The parser skips both and **rejects the file** if any other sheet name appears.

**There is no Promo Code column, and none may be added.** See
[05 — Security & anti-fraud](05-security-and-anti-fraud.md).

Limits also live in the JSON: 5 MB, 5,000 rows.

> Vercel caps a serverless request body at roughly 4.5 MB, below the 5 MB in the spec. A file
> between those two sizes fails at the platform with an unhelpful error. A realistic 5,000-row file
> is around 300 KB, so this has not bitten anyone — but lowering the limit to 4 MB is proposed.

## The template

Downloaded from `GET /api/admin/batches/template`, which **generates it live** from `sales_reps`
where `is_active = true`.

Never serve the static file in `docs/`. A stale dropdown means a departed salesperson can still be
selected and a new hire has no entry. If no salesperson is active the endpoint returns 409 with a
message telling the admin to add one first.

The generated file has the dropdown, a frozen header row, text formatting on the phone and bill
columns so leading zeros survive, and date/amount validation.

## Upload → preview

`POST /api/admin/batches/upload`, multipart, with `week_start` and `week_end` in the body.
Permission: `batches.upload`.

1. Validate the week and the file (`.xlsx`, within the size limit)
2. Hash the file; reject with 409 if a non-voided batch already has that `file_sha256`
3. Load `baht_per_point`, all `sales_reps`, and active `point_campaigns`
4. Parse once to collect the phone numbers and bill numbers present in the sheet
5. Query the database for those customers and for bill numbers already in use
6. Parse again, now with real lookups, to decide each row's final status
7. Insert a `point_batches` row with `status = 'previewed'` and the rows in `raw_rows`
8. Return a summary plus every row with its per-row errors

Parsing twice is deliberate: the parser stays a pure function taking lookups as input, so it is
testable with no database at all. For files capped at 5,000 rows this costs nothing meaningful.

**No points are written by this endpoint.**

### Row outcomes

- **valid** — will receive points on approval
- **duplicate_amount** — same phone + same purchase date + same net amount as an earlier row in the
  same file (different bill number). **Still receives points** — two real 750-baht bills on one day
  are legal — but the row is yellow, says "ยอดซ้ำกับแถว N", and the preview counts them so the approver
  sees the number before approving. Only rows with no other error take part. Switch to a hard reject
  with `duplicateAmountPolicy: 'reject'` in the upload route (one flag) if Q2 is answered that way
- **unmatched** — the phone is well-formed but no customer has it. Reported, never auto-created; a
  typo would otherwise mint a ghost account that real points flow into
- **invalid** — anything else, with a message naming the actual values

Every row also carries `warnings[]` (customer-code cross-check, duplicate notice). `warnings` never
change the status by themselves. `point_batches.valid_rows` stores valid + duplicate_amount — the rows
the RPC will award.

### Points formula

```
net        = ยอดซื้อ − ยอดลดหนี้
multiplier = the active campaign covering วันที่ซื้อ, else 1
points      = ROUND(net ÷ baht_per_point × multiplier)
expires_at  = approval date (Asia/Bangkok) + 365 days        ← migration 025, Q4 confirmed 2026-09-21
earned_month = first day of the approval month
```

Until `025` the expiry base was the purchase month (last day + 365). The customer asked for 365 days
from the day the points enter the wallet and confirmed the consequence (a late upload extends
validity). Lots issued before `025` keep their old dates. `purchase_date` is still stored on every lot
and still decides the multiplier and the week check.

A row computing to 0 points is marked invalid rather than committed, because the ledger requires
`points_earned > 0` and would abort the entire batch at commit time.

### Bill duplicate checking

The lookup uses `.in()` with the original, uppercase, and lowercase spellings — **not**
`.or(bill_no.ilike...)`.

`ilike` treats `%` and `_` as wildcards. A perfectly ordinary bill number like `INV_001` would match
unrelated bills and be rejected as a duplicate, silently refusing a legitimate sale. PostgREST does
not expose an `ESCAPE` clause, so the pattern approach cannot be made safe.

The residual gap: an unusual mixed-case spelling stored one way and uploaded another slips past the
preview. The unique index still catches it at commit, which rolls back loudly rather than failing
silently.

## State machine (since `024`)

```
draft → previewed → pending_approval → committed → voided
                        │                              ▲
                        └──────── (reject) ────────────┘
```

| Transition | Route | Permission | Money |
|---|---|---|---|
| upload → `previewed` | `POST /upload` | `batches.upload` | none |
| `previewed` → `pending_approval` | `POST /:id/submit` | `batches.upload` | none · fires team notify `batch.submitted` (Telegram / LINE group channels that subscribe to it) |
| `pending_approval` → `committed` | `POST /:id/commit` | `batches.approve` | **RPC `award_points_from_batch`** |
| `pending_approval` → `voided` (reject) | `POST /:id/void` | `batches.void` | none (no ledger yet) |
| `committed` → `voided` (rollback) | `POST /:id/void` | `batches.void` | **RPC `void_batch`** claws back |

There is no path from `previewed` straight to `committed`: the route answers 409 "ต้องส่งให้ผู้อนุมัติก่อน"
and the RPC itself refuses anything but `pending_approval`. Every transition uses an
`UPDATE … WHERE status = <from>` guard (or the RPC's row lock), so two people clicking at once get one
success and one 409. `submitted_by / submitted_at` record the submitter; `committed_by / committed_at`
are the approver (no separate approved_* columns).

Re-uploading the same file: a `previewed` twin is replaced silently; a `pending_approval` or `committed`
twin is a 409 until it is rejected / voided.

`GET /api/admin/batches/:id` returns the batch with its rows so the approver can review before
approving and accounting can reopen a `previewed` batch after a reload.

## Approve (commit)

`POST /api/admin/batches/:id/commit`. Permission: `batches.approve` (manager, super_admin).

Calls `award_points_from_batch(batch_id, admin_id)`. The admin id comes from the session and is
never accepted from the request body. The RPC does everything in one transaction: ledger rows,
balances, `point_transactions`, `committed_by`, and the status change. Rows with status `valid` **and**
`duplicate_amount` are awarded.

Afterwards, LINE push runs fire-and-forget, aggregating multiple bills for the same customer into
one message. Push failure never fails the commit.

RPC errors are translated into messages that tell the operator what to do — for example, a duplicate
bill returns 409 with "no points went to anyone, upload a corrected file", because the most important
thing to communicate is that the failure was atomic.

## Void — "ยกเลิกทั้งชุด (Rollback)" / reject

`POST /api/admin/batches/:id/void`. Permission: `batches.void`. A reason of at least 3 characters is
required — voiding claws points back from customers, so the record must say why.

Calls `void_batch`. From `committed` it returns remaining points, writes refund transactions, and marks
every row `voided`, freeing the bill numbers. From `pending_approval` it only closes the batch
(reject before any money moved). The customer calls this "batch rollback"; the columns stay
`voided_by / voided_at / void_reason`.

## Weekly batch report

`GET /api/admin/reports/batches/:id/excel` (`batches.view`) — one row per awarded bill: purchase date,
**bill number**, customer code, phone (10 digits, no dashes), name, gross, discount, net, multiplier,
points, Maker, branch (`TENANT.name`), plus a totals row and a metadata sheet naming the uploader,
submitter, approver. Bill numbers are there on purpose (`wiki/12` §5). Download buttons: per batch on
`/admin/batches` and the list on `/admin/reports`. The customer-facing export (no bill numbers) is a
different file — `/api/admin/reports/users/excel`.

## Demo assets

`docs/demo/` (git-ignored) holds a ready 10-row file: 8 valid, 1 unmatched, 1 invalid, with some rows
inside a 2× campaign window and some outside. `docs/demo/README.md` explains what each row is meant
to demonstrate.

> Its 687-point total depends on the 2× campaign running `2026-07-23 → 2026-08-05`.
> `seed_mockdata50_customers.sql` widens that window to start `2026-07-15`, which makes the same file
> total **874** — do not run it unless you have the 50-row file and accept that `docs/demo/` stops
> matching. `node scripts/repair-demo-data.js` puts the window back. See
> [09 — Status & roadmap](09-status-and-roadmap.md).

Rebuild with `node scripts/build-demo-batch.js`; verify with `node scripts/verify-demo-ready.js`,
which reads the live database so it catches seed data drifting away from the demo file.
