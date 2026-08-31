# 01 — Overview & objectives

## The business

A Thai retailer. Two branches appear in `MIGRATION_PLAN.md`: แม่ริม (the existing production
branch, ~700 real customers) and ฟ้าฮ่าม (the Phase 1 pilot target). `user_profiles.role` has exactly
two values, `contractor` (ผู้รับเหมา) and `homeowner` (เจ้าของบ้าน).

Everything customer-facing happens inside LINE. LINE Login is the identity; there is no customer
password.

> The product category is not stated outright in any document. Sample data in the Excel template
> references กระเบื้อง (tiles) and ผู้รับเหมา, which points at building materials. Treated as
> inference, not fact.

## What replaced what

The previous design had customers photograph their receipts; an OCR service (Gemini) read the
amount, and an admin approved it. `MIGRATION_PLAN.md` describes the change as a paradigm shift:

> จาก "ลูกค้าถ่ายรูปใบเสร็จ → OCR → admin approve → ได้แต้ม"
> เป็น "พนักงานขาย key Excel → บัญชี batch upload รายสัปดาห์ → ผู้จัดการสุ่มตรวจ → แต้มเข้า LINE"

The documents record the decision, not a written justification for it. What is verifiable is the
result: the shop became the source of truth, and customers now do nothing except exist in the system
with a verified phone number.

## Objectives

### 1. Points must be traceable to a real bill

Every awarded point carries the purchase date, the bill number, and the salesperson who keyed it.
A manager doing a spot-check can take any row in the weekly report and find the paper document.

Before this, a batch only recorded who uploaded the file — which was accounting, not the person who
actually keyed the numbers.

### 2. The person keying amounts cannot inflate their own numbers

This is the reason for several design choices that otherwise look over-engineered:

- The Excel sheet has **no multiplier column**. Campaign multipliers live in the back office and are
  matched by purchase date. A salesperson cannot grant a 2× bonus to their own customer.
- A bill number can only earn points **once**, enforced by a unique index rather than by app code.
- The salesperson column is a **dropdown**, not free text, so rows cannot be attributed to a
  fictional person or misspelled into anonymity.
- `accounting` can manage the salesperson list but **cannot** create campaigns. `manager` can view
  both but edit neither. The person entering money is never the person setting the multiplier.

### 3. All-or-nothing commits

If any row in a batch is bad at commit time — a duplicate bill, a multiplier that no longer matches
its campaign, a purchase date outside the declared week — the entire batch is rolled back and no
customer receives points. A partly-applied batch would be very hard to unwind by hand.

### 4. Customers are told what happened

LINE push on points earned, on approaching expiry, and on birthdays. Push failure never fails the
admin action; it is logged for retry.

### 5. Points expire fairly

Step-wise expiry. Each award is its own ledger lot with its own expiry date: the last day of the
**purchase** month plus 365 days. Redemption deducts FIFO from the lot expiring soonest.

The expiry is computed from the purchase date, not the commit date. Otherwise an accounting delay
across a month boundary would quietly hand customers an extra month of validity.

## Engineering objectives

**No silent fallbacks.** Missing configuration throws at boot with the name of the missing variable.
No `|| ''`, no default tenant code, no default `baht_per_point`. A wrong value that nobody notices is
worse than a crash that everybody notices.

**Money moves only through Postgres RPC.** API routes never `UPDATE points_balance`. The RPCs lock
the user row, run `SECURITY DEFINER`, and are granted to `service_role` only — revoked from `anon`
and `authenticated`.

**The database enforces the invariants.** Overlapping campaigns, duplicate bill numbers, and batch
rows missing traceability fields are rejected by constraints. An application bug cannot bypass them.

**One instance, one tenant.** Phase 2 runs the second branch on its own Supabase project. Nothing
hardcodes a tenant; `tenant_code` is compared between environment and database at boot.

## Phases

**Phase 1 (current)** — a brand-new instance: new Supabase project, new LINE OA and LIFF app,
empty database. The customer trials it. The live branch with ~700 real customers is not touched.

**Phase 2 (later)** — migrate the real branch onto this architecture. This is why nothing may
hardcode a tenant and why demo seed data is kept out of the migration path.
