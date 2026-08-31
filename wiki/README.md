# HugHome CRM — Wiki

Documentation an agent or a new developer should read before touching this repository.
Everything here is committed to git, unlike `docs/` which is git-ignored and local-only.

**Start with `CLAUDE.md` in the repository root.** It carries the objectives and the hard rules.
This wiki is the depth behind it.

| Page | Read it when |
|---|---|
| [01 — Overview & objectives](01-overview-and-objectives.md) | You are new, or you want to know *why* a rule exists |
| [02 — Architecture](02-architecture.md) | You need the runtime shape: LIFF, Next.js, Supabase, LINE |
| [03 — Data model](03-data-model.md) | You are touching tables, constraints, or RPCs |
| [04 — Excel batch flow](04-excel-batch-flow.md) | You are touching upload, parsing, preview, commit, or void |
| [05 — Security & anti-fraud](05-security-and-anti-fraud.md) | Before you "simplify" any validation. Most of it is load-bearing |
| [06 — RBAC](06-rbac.md) | You are adding an admin page or endpoint |
| [07 — Environment & deployment](07-environment-and-deployment.md) | Env vars, Vercel, tenant guard, cron, regenerating types |
| [08 — Migrations runbook](08-migrations-runbook.md) | You are changing the schema |
| [09 — Status & roadmap](09-status-and-roadmap.md) | You are picking up work: done, remaining, locked decisions, debt, next step |
| [10 — Conventions & rules](10-conventions-and-rules.md) | Before your first commit |
| [11 — Verification](11-verification.md) | Before you claim anything works |
| [12 — Conflicts & unverified](12-conflicts-and-unverified.md) | When a document disagrees with the code |
| [13 — Manual test plan](13-manual-test-plan.md) | Clicking the pilot end to end to hunt bugs before writing more code |

## The one-paragraph version

Sales staff fill a weekly Excel sheet. Accounting uploads it, reviews a per-row preview, and
confirms. The system matches each customer by phone, applies a campaign multiplier chosen by the
purchase date (never by anything typed into the sheet), computes points, writes a ledger lot with its
own expiry, updates the balance, and pushes a LINE message. A manager spot-checks against real bills
and can void an entire batch, which returns the points and frees the bill numbers for re-entry.

## Sourcing

Every page here is drawn from the codebase, the migrations, `MIGRATION_PLAN.md`,
`docs/PHASE1_STATUS.md`, `docs/PROMPTS.md`, and verification scripts that were actually executed.
Where a claim could not be verified it is labelled. Where documents disagree, the conflict is
recorded in [12](12-conflicts-and-unverified.md) rather than resolved by guesswork.

## Stale documentation warning

An earlier version of this product had customers photograph receipts and ran OCR over them.
**All of that is deleted.** There is no `receipts` table and no OCR.
`TESTING_GUIDE.md` and `ADMIN_RBAC_TASKS.md` in the repository root still describe that old system
and have not been rewritten. Do not trust them — see [12](12-conflicts-and-unverified.md).
