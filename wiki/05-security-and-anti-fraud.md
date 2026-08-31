# 05 — Security & anti-fraud

Read this before simplifying any validation in the batch flow. Most of it is load-bearing.

## The threat that shaped the design

Sales staff enter the amounts that become customer points. The requirement came from the project
owner directly, when the promo-code column was removed:

> "promo ขอเปลี่ยนเป็นเพิ่มจากหลังบ้าน ระบบ admin (เช่นยอดที่เกิดในช่วงวันที่เท่าไรถึงวันไหน ได้แต้มจากเงื่อนไขเพิ่ม
> แต่ไม่ใช่เป็นการกรอกของพนักงาน upload excel ป้องกันการทุจริต)"

Before this design the system recorded only which accountant uploaded a file — not who keyed any
individual row, and not which bill a point came from.

Four controls, each enforced as far down the stack as possible.

### 1. No multiplier column in the sheet

The Excel file has no Promo Code column and no multiplier column, and **none may be added**.

Multipliers live in `point_campaigns` as date ranges set in the back office. The system matches a
campaign to each row by its purchase date. A salesperson cannot grant a bonus because there is
nowhere to express one.

This replaced an earlier design where staff typed a promo code into the sheet — which meant the
person entering the amount also chose the multiplier applied to it.

*Enforced by:* absence of the column, plus the RPC re-checking at commit that the stored multiplier
still matches the campaign covering that purchase date.

### 2. A bill earns points once

```sql
CREATE UNIQUE INDEX pbl_bill_no_active_idx
  ON point_batch_ledger (upper(btrim(bill_no)))
  WHERE bill_no IS NOT NULL AND NOT voided;
```

Across every batch and every customer. Case-insensitive and whitespace-insensitive, so `inv-001`
and ` INV-001 ` collide as they should.

The preview checks this early for a good error message, but the index is the real control — a bug in
the preview cannot let a duplicate through, because the commit transaction aborts.

Voiding a batch sets `voided = true` on all its rows, releasing those numbers so a corrected file
can be re-uploaded.

*Enforced by:* a database unique index.

### 3. Every row names a real salesperson

The salesperson column is a dropdown sourced from active `sales_reps`, so rows cannot be attributed
to a fictional person or misspelled into anonymity. The parser matches by code and rejects unknown
codes; it never auto-creates a salesperson.

`sales_reps.code` is constrained to `^[A-Za-z0-9_-]{1,16}$`, which makes it impossible for a code to
contain the ` · ` separator the parser splits on — a parser invariant enforced by the database.

*Enforced by:* `pbl_batch_traceability` CHECK, plus Excel data validation, plus parser matching.

### 4. Purchases cannot drift between weeks

Accounting declares the week at upload. Any row whose purchase date falls outside it is invalid, and
the RPC checks again at commit.

Without this, an old or future purchase could be slipped into an unrelated week, and — since expiry
is computed from the purchase month — the expiry date would be wrong too.

*Enforced by:* parser validation plus an RPC raise.

## Separation of duties

| Role | Sales reps | Campaigns | Upload | Commit | Void | Review |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `accounting` | manage | **view only** | ✅ | ✅ | | |
| `manager` | view | **view only** | | | ✅ | ✅ |
| `super_admin` | manage | manage | ✅ | ✅ | ✅ | ✅ |

The person entering money is never the person setting the multiplier. `accounting` can add a
salesperson (they hand out the templates) but cannot create a campaign. `manager` sees both — needed
for spot-checks — but edits neither.

## All-or-nothing commits

`award_points_from_batch` validates every row before writing and raises on the first failure,
rolling back the transaction. A partial batch would be very hard to unwind by hand once customers
have started spending.

The commit endpoint's error messages say so explicitly, because "did some customers get points?" is
the first question an operator will ask.

## Audit trail

Four separate actors per batch — `uploaded_by`, `committed_by`, `reviewed_by`, `voided_by` — each
with its own timestamp, all potentially different people, never collapsed into one field.
`point_transactions.created_by` records the admin behind every movement.

`committed_at` and `committed_by` are constrained to be set together. Before migration 019 the most
consequential action in the system had a timestamp but no name attached.

## Application-layer security

**Customer identity comes from the session, never from a request body.** The LINE `idToken` is
verified against LINE's JWKS on every login — signature, issuer, audience, and expiry, all four.

**OTP is bound to the profile.** Verifying a phone writes `verified_phone` server-side; onboarding
refuses a phone that has not been verified in that session. An earlier version returned only
`{success: true}` and stored nothing, so the client could claim any phone.

**Rate limiting** on OTP send.

**RLS on every table with no permissive policies**, so `anon` and `authenticated` read nothing. All
access is server-side with `service_role`.

**RPCs are revoked from `anon` and `authenticated`** and granted to `service_role` only.

## Upload hardening

- File size and row count capped from `sales-columns.json`
- Formula cells reject the whole file — the cached value cannot be trusted, and formulas are a
  known injection vector
- Only three sheet names are accepted; anything else rejects the file
- Header row must match exactly; a mismatch names the offending column
- Bill numbers containing control characters are rejected
- Two-digit years are rejected rather than guessed — guessing wrong sets a wrong expiry year on real
  money

## Known gaps

- **`tenant-guard` is soft.** It throws on a real mismatch, but `instrumentation.ts` catches and only
  logs, so a build pointed at the wrong branch's database keeps serving. Fixing it means blocking
  requests (middleware returning 503), and requires first confirming
  `NEXT_PUBLIC_TENANT_CODE` on Vercel is exactly `pilot`.
- **`exceljs` advisories** — `archiver` → `glob` → `minimatch` → `brace-expansion`, and `uuid`
  v3/v5/v6. On the zip write path, not the untrusted read path, but still unresolved.
- **`/api/upload` returns 500 instead of 401** for a non-admin. Cosmetic, but it leaks the wrong
  signal.
- **Credentials were pasted into a chat transcript** during pilot setup — the admin password and
  Supabase/LINE keys. Rotation is outstanding.
- **Mixed-case bill numbers** can slip past the preview duplicate check; the unique index still
  catches them at commit.
