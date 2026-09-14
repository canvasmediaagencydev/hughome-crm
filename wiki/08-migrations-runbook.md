# 08 — Migrations runbook

Detail lives in `supabase/README.md`. This page is the summary and the traps.

## Iron rules

1. **Never edit `001`–`020`.** They are applied to the pilot database. A change means a new file.
2. **Never change the schema through the Supabase Dashboard.** Dashboard edits are the number one
   cause of drift when Phase 2 arrives.
3. **`seed_demo_data.sql` is run by hand only**, and lives in `supabase/seed/` so
   `supabase db push` never touches it.
4. **Never run a migration without asking first.** Write the file; hand it over to be pasted.

## The files

| # | File | What |
|---|---|---|
| 001 | `init_enums.sql` | 4 enums |
| 002 | `init_core_tables.sql` | `app_config`, `user_profiles`, `point_settings` (+`baht_per_point`), `point_transactions`, `tags`, `user_tags`, `user_notes` |
| 003 | `init_admin_rbac.sql` | 5 RBAC tables + admin-actor FK wiring for 002 |
| 004 | `init_rewards_redemptions.sql` | `rewards`, `redemptions` |
| 005 | `create_promo_codes.sql` | ⚠️ dropped again in 015; kept so history stays honest |
| 006 | `create_point_batches.sql` | + wires `point_transactions.source_batch_id` |
| 007 | `create_point_batch_ledger.sql` | step-wise expiry |
| 008 | `create_notification_channels.sql` | |
| 009 | `create_line_quota_cache.sql` | |
| 010 | `rpc_points_functions.sql` | award / void / redeem / expire / adjust |
| 011 | `rls_policies.sql` | RLS on every table, deny by default |
| 012 | `seed_permissions_roles.sql` | 27 permissions + 6 roles |
| 013 | `create_sales_reps.sql` | salesperson list |
| 014 | `create_point_campaigns.sql` | date-range multipliers + `EXCLUDE` no-overlap |
| 015 | `batch_ledger_traceability.sql` | ledger `+purchase_date/bill_no/sales_rep_id/campaign_id/voided`, unique bill index, `DROP TABLE promo_codes` |
| 016 | `rls_new_tables.sql` | RLS on the two new tables |
| 017 | `rpc_points_functions_v2.sql` | `earned_month` from purchase date; `void_batch` marks all rows |
| 018 | `permissions_campaigns_salesreps.sql` | `promos.*` → `campaigns.*` + `salesreps.*` → 29 total |
| 019 | `batch_committed_by.sql` | `point_batches.committed_by` + paired-with-`committed_at` CHECK |
| 020 | `rpc_award_v3_commit_actor.sql` | `award_points_from_batch(batch, admin)`; **drops** the 1-arg version |
| 021 | `redemption_lots_cancel_rpc.sql` | `redemption_lots` (which lots a redemption deducted from) · `redeem_reward` v2 records them · new `cancel_redemption(redemption, admin, note)` — refunds into the original lots + stock. Applied to the pilot 2026-09-13. |
| 022 | `notification_log_reconcile.sql` | `notification_log` (LINE push dedupe) · `balance_reconcile_log` · read-only RPC `reconcile_balances()`. **Written 2026-09-13, not yet applied.** |

Every one has a matching down-script in `supabase/migrations/rollback/`.

## Applying

| File | Use on |
|---|---|
| `supabase/_apply_all.sql` | a **fresh, empty** database |
| `supabase/_apply_013_020.sql` | a database that already has `001`–`012` |

> **Do not paste `_apply_all.sql` into the pilot.** It starts at `001` and fails immediately on
> `CREATE TYPE user_role`, which already exists.

Both are generated — never hand-edit:

```bash
node scripts/build-apply-all.js --tenant pilot        # full
node scripts/build-apply-all.js --from 013 --to 020   # incremental
```

`--tenant` has no default on purpose: the full file contains an `INSERT` for `app_config.tenant_code`,
and a guessed default would eventually be run against the wrong instance.

### The transaction trap

The Supabase SQL Editor runs a pasted script **as one transaction**. A single bad statement rolls the
whole thing back, and the error can scroll out of view — the visible result is "nothing happened at
all", which looks identical to never having pressed Run.

This actually occurred: a first paste of `_apply_013_020.sql` produced 0/13 checks passing.
Running the eight files **one at a time** succeeded with no errors.

**If a combined paste appears to do nothing, run the files individually.**

## Rollback order

`022 → 021 → 020 → 019 → 018 → 017 → 016 → 015 → 014 → 013`

- Rolling back `022` drops `notification_log` — the expiry-warning cron will re-send warnings for lots
  already warned. `balance_reconcile_log` history is lost.
- Rolling back `021` drops `redemption_lots` — the record of which lots each redemption deducted from
  is lost permanently, and `POST /api/admin/redemptions/:id/cancel` calls an RPC that no longer
  exists until the route is reverted too.

- Rolling back `020` **requires** rolling back `019` immediately after. The v2 function sets
  `committed_at` without `committed_by`, which violates the `019` CHECK — stopping halfway makes
  committing a batch impossible.
- `015` down is **destructive**: `purchase_date`, `bill_no`, and `sales_rep_id` are lost permanently.
  Acceptable only while this is a pilot.

## Verifying after apply

```bash
node scripts/verify-schema.js    # 13 checks: tables, columns, permission counts
node scripts/verify-types.js     # database.types.ts vs the live database
```

PostgREST cannot see constraints, indexes, or function signatures, so run this in the SQL Editor too
(also at the end of `_apply_013_020.sql`):

```sql
SELECT conname FROM pg_constraint WHERE conname = 'point_campaigns_no_overlap';   -- expect 1 row
SELECT indexname FROM pg_indexes WHERE indexname = 'pbl_bill_no_active_idx';      -- expect 1 row
SELECT pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'award_points_from_batch';            -- expect 'uuid, uuid', 1 row
SELECT count(*) FROM admin_permissions;                                          -- expect 29
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'cancel_redemption';                 -- expect 1 row (021)
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'reconcile_balances';                -- expect 1 row (022)
```

The function-signature check matters: two rows would mean the `DROP FUNCTION` in `020` did not take
effect and the old, non-attributing overload is still callable.

## What was actually verified on the pilot

- `verify-schema.js` → **13/13**
- Exclusion constraint tested behaviourally: overlapping range rejected with `23P01`; an
  edge-touching range accepted; an overlapping range with `is_active = false` accepted
- `award_points_from_batch` 1-arg call → `PGRST202` not found; 2-arg call → reaches the admin guard
- `e2e-batch-flow.js` → **23/23** on the real database, including `earned_month` derived from a June
  purchase date while committing in July, duplicate-bill rollback, void, and re-award after void
