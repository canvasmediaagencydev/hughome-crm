# 03 — Data model

20 tables, 4 enums, 5 RPCs. Source of truth is `supabase/migrations/`; the generated TypeScript
types are `database.types.ts` (verify with `node scripts/verify-types.js`).

## Enums

```sql
user_role         : contractor | homeowner
transaction_type  : earned | spent | expired | bonus | refund
redemption_status : requested | approved | ready | delivered | cancelled
batch_status      : draft | previewed | committed | voided
```

> `redemption_status` still carries legacy `processing` / `shipped` values in the TypeScript layer.
> Cleanup is Sprint 8.

## Core customer tables

**`user_profiles`** — one row per LINE customer.
`line_user_id` is UNIQUE NOT NULL (identity). `phone` is UNIQUE and is how the Excel batch matches
customers, so it is stored in one canonical format: local 10 digits, `0[689]xxxxxxxx`.
`birthday` is NOT NULL — required from day one so birthday greetings work without a backfill.
`points_balance` is authoritative and has `CHECK (points_balance >= 0)`.

**`point_transactions`** — append-only audit log of every movement. `points` is signed,
`balance_after` is a snapshot. `created_by` records the admin behind the movement.

**`point_settings`** — numeric key/value config. The one that matters is `baht_per_point`
(default 100). There is **no code-level default** for it; if the row is missing or invalid the
upload endpoint refuses rather than guessing.

## The batch tables

**`point_batches`** — one row per uploaded Excel file.

Four distinct actors, all optional except the uploader, and all potentially different people:

| Column | Meaning |
|---|---|
| `uploaded_by` | who sent the file in |
| `committed_by` | who pressed confirm and made points enter |
| `reviewed_by` | who spot-checked it |
| `voided_by` | who cancelled it |

`committed_at` and `committed_by` must both be set or both be null (`point_batches_commit_actor`).
Before migration 019 there was a timestamp with no person, so the most important action in the
system — actually releasing points — had no accountable name.

`raw_rows` (jsonb) stores the parsed preview so that commit does not re-parse the file.
A unique index on `file_sha256` where `status <> 'voided'` blocks re-uploading the same file.
`status` is `batch_status`: `draft · previewed · pending_approval (024) · committed · voided`.
`submitted_by / submitted_at` (024) name who sent the batch to the approver; `committed_by /
committed_at` are the approver. Both pairs have a CHECK that they are set together.

**`point_batch_ledger`** — the heart of step-wise expiry. One lot per Excel row.

```
points_earned / points_remaining   FIFO deduction happens against points_remaining
earned_month                       first day of the month the batch was APPROVED (since 025, Q4 · before: purchase month)
expires_at                         approval date (Asia/Bangkok) + 365 days (since 025 · before: last day of purchase month + 365)
                                   lots issued before 025 keep their old dates — mixed rules coexist in one table
purchase_date, bill_no, sales_rep_id, campaign_id     traceability
voided                             set by void_batch; frees the bill number
```

**Invariant:** `user_profiles.points_balance == SUM(point_batch_ledger.points_remaining)`.
A daily reconcile cron is planned for Sprint 7 and must **log and alert**, never silently auto-fix.

Constraints worth knowing before you write a migration:

- `pbl_batch_traceability` — rows with `source = 'batch'` must have `purchase_date`, `bill_no`, and
  `sales_rep_id`. Rows from `adjust_points_manual` use `source = 'manual'` and legitimately have
  none of them, which is why the check is conditional.
- `pbl_bill_no_active_idx` — `UNIQUE (upper(btrim(bill_no))) WHERE bill_no IS NOT NULL AND NOT voided`.
  One bill earns points once, across every batch and every customer. Voiding a batch marks its rows
  `voided`, which releases the numbers so a corrected file can be re-uploaded.

## Campaigns and sales reps

**`point_campaigns`** — replaced the old `promo_codes` table, which was dropped in migration 015.

```sql
multiplier numeric(4,2) CHECK (multiplier > 0)
starts_on, ends_on date        -- both inclusive
is_active boolean              -- soft delete; the ledger references campaigns

ALTER TABLE point_campaigns
  ADD CONSTRAINT point_campaigns_no_overlap
  EXCLUDE USING gist ((daterange(starts_on, ends_on, '[]')) WITH &&)
  WHERE (is_active);
```

The exclusion constraint means **any given day has at most one active multiplier**, so selecting a
campaign for a purchase date is deterministic and needs no tie-break rule. Tie-break rules are
exactly what people argue about six months later when a customer disputes their points.

A UI creating an overlapping range gets Postgres error `23P01` and must translate it into readable
Thai naming the conflicting campaign and its dates.

**`sales_reps`** — the salesperson list that fills the Excel dropdown.

`code` is constrained to `^[A-Za-z0-9_-]{1,16}$`. That is not cosmetic: it guarantees the code can
never contain the ` · ` separator the parser uses to split the dropdown label `CODE · Name`, so a
parser invariant is enforced by the database.

Named `sales_reps`, not `sales_staff`, because `'sales_staff'` was already taken as an
`admin_roles.name` value in migration 012.

Deletion is blocked by `ON DELETE RESTRICT` from the ledger. Someone who leaves is deactivated
(`is_active = false`), which removes them from future templates while their historical rows stay
attributable. There is deliberately no delete button in the UI.

## RPCs

All are `SECURITY DEFINER`, `SET search_path = public, pg_temp`, revoked from `anon` and
`authenticated`, and granted to `service_role` only. All lock `user_profiles` with `FOR UPDATE`
before touching a balance.

```sql
award_points_from_batch(p_batch_id uuid, p_admin uuid) → integer
void_batch(p_batch_id uuid, p_admin uuid, p_reason text) → void
redeem_reward(p_user uuid, p_reward uuid, p_qty integer) → uuid
expire_ledger_batches(p_as_of date)
adjust_points_manual(p_user uuid, p_delta integer, p_admin uuid, p_note text) → integer
```

`award_points_from_batch` took one argument until migration 020. The single-argument version was
**dropped**, not left as an overload — an overload is exactly how someone accidentally calls the
version that does not record who committed.

What it validates per row before writing anything:

1. `p_admin` is an existing, active admin
2. the batch is in `previewed` status
3. `purchase_date` falls inside the batch's declared week
4. the `sales_rep_id` exists
5. the stored `multiplier` still matches the campaign that actually covers `purchase_date`

Any failure raises, which rolls back the whole batch. Check 5 catches a campaign being edited
between preview and commit — better to fail loudly and re-preview than to award the wrong multiplier.

`void_batch` marks `voided = true` on **every** row of the batch, not only rows that still have
points remaining. Rows the customer already spent would otherwise keep their bill numbers locked
forever.

## `raw_rows` contract

The Sprint 4 parser writes this shape; the commit RPC reads it. Keep them in sync.

```json
{
  "status": "valid",
  "user_id": "<uuid>", "points": 45,
  "purchase_date": "2026-06-15", "bill_no": "INV-001", "sales_rep_id": "<uuid>",
  "gross": 5000, "discount": 500, "net": 4500,
  "campaign_id": null, "multiplier": 1
}
```

Rows whose `status` is not `valid` are ignored at commit.
