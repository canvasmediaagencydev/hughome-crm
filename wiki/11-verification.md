# 11 — Verification

No test framework is configured. Verification is a set of scripts, each exiting non-zero on failure.

## Always

```bash
npx tsc --noEmit
npm run build
```

## Offline — no database needed

```bash
node scripts/test-parse-sales-batch.js
```

29 checks over the Excel parser: missing leading zero on a phone, thousands separators, the word
"บาท" in an amount, Buddhist-era dates, a date outside the declared week, a bill duplicated within
the file, a bill already used in an earlier batch, an unknown or deactivated salesperson, a phone not
in the system (must be `unmatched`, not `invalid`), a blank row in the middle, an amount rounding to
zero points, a two-digit year (must be rejected, not guessed), a wrong header, an extra column, a
formula cell, an unexpected sheet, and a row count over the limit.

The parser is TypeScript; the script transpiles it with the TypeScript compiler API into
`node_modules/.cache` — inside the project so `exceljs` resolves — and rewrites the `@/lib/phone`
alias and the JSON import.

```bash
node scripts/verify-demo-batch.js
```

17 checks: runs the demo file through the parser with a simulated context and compares every row's
points against a hand calculation, including one worked step-by-step example inside a 2× campaign.

## Against the live database — read only

```bash
node scripts/verify-schema.js     # 13 checks: tables, columns, permission counts
node scripts/verify-types.js      # database.types.ts vs live: 20 tables, 178 columns, nullability
node scripts/verify-demo-ready.js # 19 checks: seed matches the demo file, bills unused, file not yet uploaded
```

`verify-demo-ready.js` is the one to run before a demo. Unlike `verify-demo-batch.js` it builds the
parser context from the **live** database, so it catches seed data drifting away from the demo file.

### What these cannot see

PostgREST exposes tables and columns, not constraints, indexes, or function signatures. Run in the
SQL Editor:

```sql
SELECT conname FROM pg_constraint WHERE conname = 'point_campaigns_no_overlap';
SELECT indexname FROM pg_indexes WHERE indexname = 'pbl_bill_no_active_idx';
SELECT pg_get_function_identity_arguments(p.oid)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = 'award_points_from_batch';   -- expect 'uuid, uuid', one row
```

`verify-types.js` covers `Tables` only — not `Enums`, `Functions`, or `CompositeTypes`.

## Against the live database — writes

```bash
node scripts/e2e-batch-flow.js
```

⚠️ **Writes to the database.** It creates its own throwaway customer (`line_user_id` prefixed
`E2E-TEST-`) so no real customer is touched, and deletes everything it created at the end, including
on failure. It then confirms nothing was left behind.

23 checks covering the whole money path: points actually land; `earned_month` comes from a June
purchase date while committing in July, giving `2026-06-01` and expiry `2027-06-30`; `committed_by`
and `point_transactions.created_by` record the acting admin; a duplicate bill is rejected by the
unique index and rolls the whole batch back with no balance change; `void_batch` returns the points
and marks rows `voided`; the same bill can then be re-awarded; and
`points_balance == SUM(points_remaining)` still holds.

This is the script that proved RPC v3 works — before it ran, that `plpgsql` had never executed.

## SQL syntax checking without a database

There is no local Postgres or Docker on the development machine. SQL was parse-checked with
`pgsql-parser` (libpg_query) installed in a temporary directory outside the project.

**This only checks outer syntax.** `plpgsql` function bodies are opaque strings to that parser, and
semantics such as `EXCLUDE USING gist` are not evaluated. Parse-clean is not the same as runs-clean —
which is exactly why `e2e-batch-flow.js` exists.

## Not covered by any script

**The full flow through a browser with a real login.** Admin authentication is a client-side Supabase
`signInWithPassword`, and no script drives it. Everything from the HTTP layer up has only been
smoke-tested: pages return 200, unauthenticated APIs return 401.
