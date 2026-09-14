# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repository.
**Read this file completely before making any change.** For depth, see `wiki/`.

---

## 1. What this project is

**HugHome CRM ("Hug Point")** — a loyalty/points platform for a Thai building-materials retailer,
delivered through LINE. Customers are contractors (`ผู้รับเหมา`) and homeowners (`เจ้าของบ้าน`).

**The core loop:**

```
[Sales staff]  fill a weekly Excel sheet (purchase date, bill no, customer phone, amount, salesperson)
[Accounting]   upload the .xlsx to the admin back office, pick the week, review the preview, confirm
[System]       normalize phone, match customer, find the campaign multiplier by purchase date,
               compute points, write the ledger, update balance, push a LINE message
[Manager]      spot-check the weekly report against real bills; void the whole batch if wrong
[Customer]     opens LIFF, sees balance + next expiry, redeems a reward, picks it up in store
```

**Paradigm note — this is the #1 thing stale docs get wrong.**
An older version of this system had customers photograph receipts and ran OCR (Gemini) on them.
**That flow is deleted.** There is no `receipts` table, no OCR, no receipt upload. Points enter the
system *only* through the Excel batch flow above (plus manual admin adjustment).
If you find a doc or comment mentioning receipts/OCR, it is stale — trust the code and `wiki/`.

---

## 2. Objectives

### Product objectives
1. **Points must be trustworthy.** Every point traceable to a purchase date, a bill number, and a
   named salesperson. A manager must be able to pick any awarded point and find the paper bill.
2. **Sales staff cannot inflate their own numbers.** The people who key the amounts must not also
   control the multiplier, and must not be able to claim the same bill twice.
3. **Nothing silently half-happens.** A batch either awards every valid row or awards none.
4. **Customers get told.** Points in, expiry warning, birthday — via LINE push.
5. **Points expire fairly.** Step-wise expiry: each award is its own lot with its own expiry date
   (last day of the purchase month + 365 days), deducted FIFO when redeeming.

### Engineering objectives
1. **No silent fallbacks.** Missing config throws at boot. Never `|| ''`, never a default tenant code,
   never a default `baht_per_point`. A silent wrong value is worse than a crash.
2. **All money movement goes through Postgres RPC**, never through an API route doing `UPDATE`.
   RPCs lock rows, are `SECURITY DEFINER`, and are granted to `service_role` only.
3. **The database enforces the rules**, not just the app. Overlapping campaigns, duplicate bills, and
   missing traceability fields are blocked by constraints, so a code bug cannot bypass them.
4. **One instance, one tenant.** Phase 2 runs a second branch on its own Supabase project. Nothing
   may hardcode a tenant.

### Phase objectives
- **Phase 1 (now):** a fresh pilot instance (new Supabase + new LINE OA/LIFF) for the customer to
  trial. The existing production branch with ~700 real customers is untouched.
- **Phase 2 (later):** migrate the real branch onto this architecture.

---

## 3. Current state

| | |
|---|---|
| Branch | `pilot-phase1` → Vercel production https://pilot-phase1.vercel.app |
| Supabase | pilot project `vltzkxmblmrvsmaookhl` (`hughome-pilot`, org of `canvasmediaagency@gmail.com`, Tokyo), `app_config.tenant_code = 'pilot'` · replaced `zoaxqouayhjkyterzzdt` on 2026-09-14 — see `wiki/07` |
| Migrations | `001`–`022`, all applied to pilot (fresh project 2026-09-14) |
| Sprints done | 0 – 7 (Sprint 5 minus `POST /:id/review` and `GET /:id`) |
| Sprints left | 8 (notify + redemption statuses + QR) · 9 (user UI + reports + demo data) |

Living status: **`wiki/08-status-and-roadmap.md`** and `docs/PHASE1_STATUS.md`.
Sprint-by-sprint work prompts: `docs/PROMPTS.md`.
Full design rationale: `MIGRATION_PLAN.md`.

> ⚠️ `/docs` is in `.gitignore`. Those files exist on the working machine but are **not in git**.
> Anything an agent must be able to read from a fresh clone belongs in `wiki/` or a root doc.

---

## 4. Hard rules — do not break these

These come from `docs/PROMPTS.md` and have been enforced all along.

- **No fallback or default value for any config or env.** Throw instead.
- **Never touch `.env.local`.** It holds live pilot credentials.
- **Never run a migration or write to Supabase without asking first.** Write the `.sql` file, hand it
  over to be pasted into the SQL Editor.
- **Never edit an applied migration** (`001`–`022`). New change = new file.
- **Never `npm install` / `uninstall` without asking.**
- **Never `git commit` or `git push` unless explicitly told to.**
- **Never put a real phone number or a real person's name in the repo.**
- **Do not change `src/lib/excel/sales-columns.json` without asking.** Sales staff hold templates
  built from that spec; changing it mid-week invalidates sheets already filled in.
- **Business decisions stop the work.** If something requires a business call, ask; do not guess.
- **If `MIGRATION_PLAN.md` contradicts the code, stop and report.** Do not silently rewrite the plan.
- **Stay inside the current sprint's scope.**

---

## 5. Tech stack

Next.js 15.5.2 (App Router, Turbopack) · React 19.1.0 · TypeScript 5 (strict) · Tailwind CSS 4 ·
shadcn/ui · Supabase (Postgres + RLS + Storage) · LINE Login via LIFF SDK 2.27.2 + Messaging API ·
`exceljs` for all Excel read/write.

> `xlsx@0.18.5` was **removed** (prototype pollution + ReDoS — unusable for reading uploaded files).
> Do not reintroduce it.

---

## 6. Commands

```bash
npm run dev                      # dev server (Turbopack)
npm run build                    # production build
npx tsc --noEmit                 # typecheck — run before claiming done

# verification scripts (no test framework in this project)
node scripts/test-parse-sales-batch.js   # Excel parser self-check, no DB needed
node scripts/test-campaign-rules.mjs     # campaign overlap/validation self-check, no DB needed
node scripts/verify-schema.js            # is the DB schema what the code expects
node scripts/verify-types.js             # does database.types.ts match the live DB
node scripts/verify-demo-batch.js        # demo file vs hand-computed points
node scripts/verify-demo-ready.js        # is the pilot DB ready to demo (reads live DB)
node scripts/e2e-batch-flow.js           # ⚠️ WRITES to the DB — creates its own throwaway
                                         #    customer, then deletes everything it made
node scripts/e2e-points-invariant.js --yes  # ⚠️ WRITES — balance == SUM(ledger) after adjust/redeem/
                                         #    expire/cancel; runs expire_ledger_batches(today) for real
node scripts/verify-cron-auth.js <base-url> # every cron + /api/admin/quota returns 401 unauthenticated

# generators
node scripts/build-apply-all.js --tenant pilot          # rebuild supabase/_apply_all.sql
node scripts/build-apply-all.js --from 013 --to 020     # incremental apply file
node scripts/generate-sales-template.js --staff "S01:ชื่อ,S02:ชื่อ"
node scripts/build-demo-batch.js                        # rebuild the demo .xlsx
```

Regenerating DB types needs a Supabase login (interactive, cannot be done from a non-TTY agent shell):

```bash
npx supabase login
npx supabase gen types typescript --project-id vltzkxmblmrvsmaookhl > /tmp/t.ts && mv /tmp/t.ts database.types.ts
```

> Never write `... > database.types.ts` directly. The shell truncates the file *before* the command
> runs, so a failed login leaves you with a 0-byte file. (This has already happened once;
> recovery was `git restore database.types.ts`.)

---

## 7. Key files

| Path | Why it matters |
|---|---|
| `src/lib/excel/sales-columns.json` | **Single source of truth** for the Excel column spec. Both the plain-JS generator and the TS parser read it. Never redeclare headers anywhere else. |
| `src/lib/excel/parse-sales-batch.ts` | The parser. Pure — takes a Buffer plus lookups, returns rows. No DB access, so it is testable offline. |
| `src/lib/excel/build-template.js` | Template builder, CommonJS so both the CLI script and the API route use one implementation. |
| `src/app/api/admin/batches/*` | upload (preview) · commit · void · list · template |
| `src/app/api/cron/*` | 4 crons per `MIGRATION_PLAN.md` §6.3; all gated by `verifyCronRequest`; money moves only via RPC; `reconcile-balances` is read-only and returns 500 on drift so Vercel flags the run |
| `src/lib/notification-log.ts`, `src/lib/line-quota.ts` | LINE push dedupe (`notification_log`) · LINE quota cache (15 min) |
| `src/app/api/admin/campaigns/*`, `src/lib/campaigns.ts` | campaign CRUD; overlap pre-check + `23P01` translation naming the conflicting campaign; `campaigns.manage` gate |
| `src/config/env.ts`, `src/config/tenant.ts` | Boot-time env validation and tenant config. No defaults by design. |
| `src/config/tenant-guard.ts` | Checks the connected DB belongs to this tenant. Currently **soft** — see debt list. |
| `src/lib/phone.ts` | Canonical Thai phone normalization. Identity is the local 10-digit form. |
| `supabase/migrations/` | `001`–`020` up, `rollback/` down. |
| `supabase/seed/seed_demo_data.sql` | Demo data. **Outside** the migration path on purpose. |
| `database.types.ts` | Generated Supabase types. Verify with `scripts/verify-types.js`. |

---

## 8. Known debt (do not be surprised by these)

- **`tenant-guard` is soft.** It throws on a real mismatch, but `src/instrumentation.ts` catches the
  error and only logs. Making it fail closed requires first confirming `NEXT_PUBLIC_TENANT_CODE` on
  Vercel is exactly `pilot`, or the whole site returns errors.
- `exceljs` carries its own advisories (`archiver`→`glob`→`minimatch`→`brace-expansion`, and `uuid`
  v3/v5/v6). Both sit on the zip **write** path, not the untrusted-file **read** path — but that is
  not the same as "no vulnerabilities".
- `/api/upload` returns 500 instead of 401 for a non-admin (cosmetic).
- Redemption status type still carries legacy `processing` / `shipped` (Sprint 8).
- Stale leftovers still mention receipts in `src/app/admin/page.tsx`, `src/components/StatusBadge.tsx`,
  dashboard metrics routes, and `TESTING_GUIDE.md` / `ADMIN_RBAC_TASKS.md`.
- A fresh Phase 2 database will `CREATE promo_codes` in `005` and `DROP` it in `015`. Harmless noise,
  kept so the migration history stays honest.
- Operational: rotate the admin password and the LINE/Supabase keys that were pasted into chat;
  delete pilot test data; wire a real SMS provider (OTP currently works for one test number only).

---

## 9. Where to look next

`wiki/README.md` is the index. The pages most likely to matter:

| Page | For |
|---|---|
| `wiki/04-excel-batch-flow.md` | the flow this whole product is built around |
| `wiki/05-security-and-anti-fraud.md` | why the design looks the way it does — read before simplifying any validation |
| `wiki/07-environment-and-deployment.md` | env vars, Vercel, tenant guard, cron, regenerating types |
| `wiki/08-migrations-runbook.md` | before any schema change |
| `wiki/09-status-and-roadmap.md` | completed, remaining, locked decisions, open debt, next step |
| `wiki/12-conflicts-and-unverified.md` | **read this when a document disagrees with the code** |

`MIGRATION_PLAN.md` is the original decision record — long, and authoritative on *why*.

## 10. Sourcing of this documentation

`CLAUDE.md` and `wiki/` were written from the codebase, the migrations, `MIGRATION_PLAN.md`,
`docs/PHASE1_STATUS.md`, `docs/PROMPTS.md`, and verification scripts that were actually executed.
Claims that could not be verified are labelled as such. Conflicts between documents are recorded in
`wiki/12-conflicts-and-unverified.md` rather than resolved by guessing.

Two root documents — `TESTING_GUIDE.md` and `ADMIN_RBAC_TASKS.md` — still describe the deleted
OCR/receipt system and were **not** rewritten, because deciding what should replace them is a scope
decision. Do not trust them.
