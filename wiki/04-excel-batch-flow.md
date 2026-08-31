# 04 — Excel batch flow

The flow the whole product exists to support.

## Roles in the flow

| Who | Does what | Has a login? |
|---|---|---|
| Sales staff | fills the sheet daily, sends the file to accounting weekly | **No** |
| Accounting (`accounting`) | uploads, reviews the preview, confirms | Yes |
| Manager (`manager`) | spot-checks the weekly report, voids a bad batch | Yes |

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

Sheet `ยอดซื้อ`, header on row 1, 8 columns:

| # | Column | Required | Notes |
|---|---|:--:|---|
| A | `วันที่ซื้อ` | ✅ | date cell, or `dd/mm/yyyy` text. Buddhist years converted automatically (year > 2400 → −543). Must fall inside the uploaded week |
| B | `เลขที่บิล` | ✅ | ≤ 64 characters. Unique across the whole system except in voided batches |
| C | `เบอร์โทรลูกค้า` | ✅ | 10 digits. `8xx` auto-corrected to `08xx`. Must start `0[689]` |
| D | `ชื่อลูกค้า` | | for eyeballing only — matching is by phone alone |
| E | `ยอดซื้อ` | ✅ | number > 0 |
| F | `ยอดลดหนี้` | | blank = 0, must not exceed the purchase amount |
| G | `พนักงานขาย` | ✅ | **dropdown** of active `sales_reps`, label `CODE · Name` |
| H | `หมายเหตุ` | | internal, never shown to the customer |

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

- **valid** — will receive points on commit
- **unmatched** — the phone is well-formed but no customer has it. Reported, never auto-created; a
  typo would otherwise mint a ghost account that real points flow into
- **invalid** — anything else, with a message naming the actual values

### Points formula

```
net        = ยอดซื้อ − ยอดลดหนี้
multiplier = the active campaign covering วันที่ซื้อ, else 1
points      = ROUND(net ÷ baht_per_point × multiplier)
```

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

## Commit

`POST /api/admin/batches/:id/commit`. Permission: `batches.commit`.

Calls `award_points_from_batch(batch_id, admin_id)`. The admin id comes from the session and is
never accepted from the request body. The RPC does everything in one transaction: ledger rows,
balances, `point_transactions`, `committed_by`, and the status change.

Afterwards, LINE push runs fire-and-forget, aggregating multiple bills for the same customer into
one message. Push failure never fails the commit.

RPC errors are translated into messages that tell the operator what to do — for example, a duplicate
bill returns 409 with "no points went to anyone, upload a corrected file", because the most important
thing to communicate is that the failure was atomic.

## Void

`POST /api/admin/batches/:id/void`. Permission: `batches.void`. A reason of at least 3 characters is
required — voiding claws points back from customers, so the record must say why.

Calls `void_batch`, which returns remaining points, writes refund transactions, and marks every row
`voided`, freeing the bill numbers.

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
