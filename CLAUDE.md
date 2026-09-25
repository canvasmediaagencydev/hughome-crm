# CLAUDE.md

Guidance for Claude Code (and any AI agent) working in this repository.
**Read this file completely before making any change.** For depth, see `wiki/`.

---

## 1. What this project is

**HugHome CRM ("Hug Point")** — a loyalty/points platform for a Thai building-materials retailer,
delivered through LINE. Customers are contractors (`ผู้รับเหมา`) and homeowners (`เจ้าของบ้าน`).

**The core loop:**

```
[Maker]        fill a weekly Excel sheet (customer code, purchase date, bill no, customer phone, amount, Maker)
               — "Maker" is the customer's word for sales staff (2026-09-21); table/role names unchanged
[Accounting]   upload the .xlsx to the admin back office, pick the week, review the preview, SUBMIT
[Approver]     (manager, `batches.approve`) review the pending batch, approve → points enter, or reject
[System]       normalize phone, match customer (code is a cross-check warning), find the campaign
               multiplier by purchase date, compute points, write the ledger, update balance, push LINE
[Manager]      download the weekly batch report (with bill numbers), void ("Rollback") the whole batch if wrong
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
5. **Points expire fairly.** Step-wise expiry: each award is its own lot with its own expiry date,
   deducted FIFO when redeeming. **Since migration `025` (Q4 confirmed 2026-09-21): expiry = the day
   the approver released the batch + 365 days** (`earned_month` = approval month). Lots issued before
   `025` keep the older "last day of purchase month + 365" date. The purchase date still decides the
   campaign multiplier and the week check.
6. **Points enter only after an approver clicks.** Accounting uploads and submits; a `manager` with
   `batches.approve` approves (migration `024`). No path from `previewed` straight to `committed`.

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
| Branch | `pilot-phase1` → Vercel production https://pilot-phase1.vercel.app (latest push `94d50b1` 2026-09-25; Vercel account on Pro) |
| Supabase | pilot project `vltzkxmblmrvsmaookhl` (`hughome-pilot`, org of `canvasmediaagency@gmail.com`, Tokyo), `app_config.tenant_code = 'pilot'` · replaced `zoaxqouayhjkyterzzdt` on 2026-09-14 — see `wiki/07` |
| Migrations | `001`–`026` all applied to pilot (`024`–`026` on 2026-09-21 via SQL Editor; `verify-schema.js` 23/23, `verify-types.js` clean, `e2e-batch-flow.js` 35/35) |
| Sprints done | 0 – 8 · 9R deployed `ec5e79f` 2026-09-21 · **Sprint 10 part 1 same day**: email team notify (Resend), Telegram/LINE-group creation removed, customer-code import, Rollback = super_admin only · Sprint 5 leftover `POST /:id/review` on hold (Q12) · **2026-09-25** (`94d50b1`): SMS OTP via ThaiBulkSMS (verified on a phone), LINE Login channel published, `wiki/13` §10–§11 clicked on prod (money path clean — `wiki/13` §12) |
| Sprints left | prove role separation (`wiki/13` 10.2/10.5/10.7, needs a second admin account) · own SMS sender name · 10–11 — see `wiki/09` Remaining · open questions Q1 Q2 Q3 Q6–Q12 in `wiki/14` §4 |
| Customer requirements | **`wiki/14-customer-meeting-2026-09-delta.md`** — answered and built 2026-09-21: Q1 (numeric codes imported from the old system), Q2 (duplicate = warning), Q3 (Rollback = super_admin), Q4 (expiry from approval date), Q5 (Excel v2), Q6 (email instead of Telegram/LINE group), Q7 (no customer push). Still open: Q8 Q9 Q10 Q11-sender-domain Q12 |
| Rehearsal | `wiki/13` §1–6 + 8.3 clicked on production 2026-09-14 — money path clean; §7 (phone/LIFF) and clean-up §9 still open. Findings: `wiki/09` Open debt |

Living status: **`wiki/09-status-and-roadmap.md`** and `docs/PHASE1_STATUS.md`.
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
- **Never edit an applied migration** (`001`–`026`). New change = new file.
- **Never `npm install` / `uninstall` without asking.**
- **Never `git commit` or `git push` unless explicitly told to.**
- **Never put a real phone number or a real person's name in the repo.**
- **Do not change `src/lib/excel/sales-columns.json` without asking.** Sales staff hold templates
  built from that spec; changing it mid-week invalidates sheets already filled in. (v2 — 9 columns,
  `รหัสลูกค้า` first, header `Maker` — was approved by the customer on 2026-09-21 before any real sheet
  was issued.)
- **Business decisions stop the work.** If something requires a business call, ask; do not guess.
  The open ones are numbered in `wiki/14` §4 (Q1–Q12); refer to them by number.
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
node scripts/test-sprint8-rules.mjs      # redemption status order, pickup code, token encryption — no DB
node scripts/verify-schema.js            # is the DB schema what the code expects
node scripts/verify-types.js             # does database.types.ts match the live DB
node scripts/verify-demo-batch.js        # demo file vs hand-computed points
node scripts/verify-demo-ready.js        # is the pilot DB ready to demo (reads live DB)
node scripts/e2e-batch-flow.js           # ⚠️ WRITES to the DB — creates its own throwaway
                                         #    customer, then deletes everything it made
                                         #    9R: previewed → submit → approve → dup → rollback → reject
                                         #    needs migrations 024 + 025 applied
node scripts/build-sample-reports.js [--from-db]  # docs/demo/sample_customers_export.xlsx +
                                         #    sample_batch_report.xlsx (fake names always)
node scripts/e2e-points-invariant.js --yes  # ⚠️ WRITES — balance == SUM(ledger) after adjust/redeem/
                                         #    expire/cancel; runs expire_ledger_batches(today) for real
node scripts/verify-cron-auth.js <base-url> # every cron + /api/admin/quota returns 401 unauthenticated
node scripts/e2e-sprint8-http.js --yes [base-url] # ⚠️ WRITES + hits prod admin API with a magic-link admin
                                         #    token — 4 statuses, QR lookup, cancel, notification channels;
                                         #    cleans up its own customer/reward/channels

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
| `src/lib/excel/build-reports.js` | Both Excel reports (customer export without bill numbers · weekly batch report with them), CommonJS, shared by the routes and `scripts/build-sample-reports.js`. |
| `src/app/api/admin/batches/*` | upload (preview) · `[id]` detail with rows · `[id]/submit` (→ pending_approval) · `[id]/commit` (= approve, `batches.approve`) · `[id]/void` (reject or rollback) · list · template |
| `src/app/api/admin/reports/*` | `users/excel` customer export · `batches/[id]/excel` weekly batch report |
| `src/lib/dashboard-metrics.ts` | The `/admin` numbers with `?from=&to=` (Bangkok dates); shared by `dashboard/metrics` and `dashboard/all` |
| `src/app/api/cron/*` | 4 crons per `MIGRATION_PLAN.md` §6.3; all gated by `verifyCronRequest`; money moves only via RPC; `reconcile-balances` is read-only and returns 500 on drift so Vercel flags the run |
| `src/lib/notification-log.ts`, `src/lib/line-quota.ts` | LINE push dedupe (`notification_log`) · LINE quota cache (15 min) |
| `src/lib/redemption-status.ts` | The 4-status model (`requested → approved → ready → delivered`, `cancelled`), labels, `NEXT_STATUS`, pickup-code format. Client- and server-safe. |
| `src/lib/team-notify.ts`, `src/lib/secret-box.ts` | Team notify on `redemption.created` / `batch.submitted` — **email via Resend** (`RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`; Sprint 10, Q6) is the only creatable channel; legacy Telegram / LINE-group rows still deliver. Never fails the caller; errors go to `notification_channels.last_error` · AES-256-GCM for legacy Telegram tokens (`NOTIFY_TOKEN_KEY`) |
| `src/app/api/admin/redemptions/*` | list · `[id]/status` (PATCH, one step forward, race-safe) · `[id]/cancel` (RPC) · `lookup?code=` (QR scan) |
| `src/app/api/admin/notifications/*` | channel CRUD + `[id]/test`; GET always masks the token |
| `src/app/api/admin/users/import-codes`, `src/lib/customer-code.ts`, `/admin/customer-codes` | Q1: numeric customer codes from the old system, imported by xlsx (code, phone) — match by phone, dry-run then apply |
| `src/app/api/admin/campaigns/*`, `src/lib/campaigns.ts` | campaign CRUD; overlap pre-check + `23P01` translation naming the conflicting campaign; `campaigns.manage` gate |
| `src/config/env.ts`, `src/config/tenant.ts` | Boot-time env validation and tenant config. No defaults by design. |
| `src/config/tenant-guard.ts` | Checks the connected DB belongs to this tenant. Currently **soft** — see debt list. |
| `src/lib/phone.ts` | Canonical Thai phone normalization. Identity is the local 10-digit form. |
| `supabase/migrations/` | `001`–`023` up, `rollback/` down. |
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
- `/api/upload`, `/api/admin/users`, `/api/admin/redemptions` return 500 instead of 401 unauthenticated
  (catch-all does not special-case `Unauthorized`; `batches/route.ts` does it right).
- **Supabase Auth on the pilot (free tier) can answer `GET /auth/v1/user` with 504.** Every admin route
  goes through `requirePermission` → `auth.getUser()`, so a slow answer becomes a 500 on the route and
  a bounce to `/admin/login` from `useAdminAuth`. Seen twice in 23 s on 2026-09-14. Not a code bug in
  the money path — check Vercel logs before blaming an RPC.
- A `previewed` batch has no commit/void button in the history table after reload — re-upload the same
  file (the upload replaces the old preview; sha256 only blocks `committed` files).
- Batch history omits who voided; commit toast counts attempted LINE pushes, not delivered ones.
- **`NOTIFICATIONS_ENABLED` on Vercel production is `false` — by decision (Q7, 2026-09-21):** points enter weekly,
  so no customer LINE push. Every LINE push (batch award, expiry, birthday) is a no-op on purpose. Team notify
  goes by email instead.
- The Supabase auth flake also shows up as a transient **403** (`verifyAdminSession` read fails → "Not an admin"),
  not only 500 — seen once in 51 prod calls on 2026-09-14.
- `NOTIFY_TOKEN_KEY` is *optional at boot* (so an instance without Telegram still runs) but any attempt
  to save or send a Telegram channel without it throws — no plaintext fallback.
- The original pilot project `zoaxqouayhjkyterzzdt` is orphaned (no known owner account) — see `wiki/07`. Never point anything at it again.
- On a fresh Supabase project keep **"Automatically expose new tables"** on, or new tables never reach PostgREST.
- Stale leftovers still mention receipts in `src/app/api/admin/analytics/route.ts`,
  `src/app/admin/roles/page.tsx`, `src/lib/line-messaging.ts`, and `TESTING_GUIDE.md` /
  `ADMIN_RBAC_TASKS.md` (dashboard routes, hook, tiles and `StatusBadge` were cleaned in 9R).
- `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` are set on Vercel production (since 2026-09-22, domain `canvasmkt.com`
  verified in Resend) but **not** in `.env.local`, so local dev cannot send team email.
- Customer OTP goes through ThaiBulkSMS OTP Manager (`src/lib/thaibulksms-otp.ts`), not Supabase Auth.
  `THAIBULKSMS_OTP_KEY` / `THAIBULKSMS_OTP_SECRET` are required at boot — set on Vercel and in `.env.local`
  (appended 2026-09-25 at the owner's request; local `npm run build` passes). Sender is the shared `OTP_SMS` until an own sender name is approved.
- `NEXT_PUBLIC_TENANT_PHONE` / `NEXT_PUBLIC_TENANT_FB_URL` hold the real shop values on Vercel since 2026-09-21
  (`36442f5`); `/call` formats the 9-digit number as 052-000-369.
- A fresh Phase 2 database will `CREATE promo_codes` in `005` and `DROP` it in `015`. Harmless noise,
  kept so the migration history stays honest.
- Operational: the new pilot admin has no working password until set via `auth.admin.updateUserById`;
  reward images missing.

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
| `wiki/14-customer-meeting-2026-09-delta.md` | the customer's latest requirements (2026-09-21) mapped onto the code, and what blocks them |

`MIGRATION_PLAN.md` is the original decision record — long, and authoritative on *why*.

## 10. Sourcing of this documentation

`CLAUDE.md` and `wiki/` were written from the codebase, the migrations, `MIGRATION_PLAN.md`,
`docs/PHASE1_STATUS.md`, `docs/PROMPTS.md`, and verification scripts that were actually executed.
Claims that could not be verified are labelled as such. Conflicts between documents are recorded in
`wiki/12-conflicts-and-unverified.md` rather than resolved by guessing.

Two root documents — `TESTING_GUIDE.md` and `ADMIN_RBAC_TASKS.md` — still describe the deleted
OCR/receipt system and were **not** rewritten, because deciding what should replace them is a scope
decision. Do not trust them.
