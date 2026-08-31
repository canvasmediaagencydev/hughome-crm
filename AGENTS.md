# Repository Guidelines

> Read `CLAUDE.md` first — it carries the project objectives and the hard rules.
> `wiki/` holds the depth. This file is conventions only.

## Project structure

- `src/app` — Next.js App Router. Customer LIFF pages at the root, back office under `admin/`,
  endpoints under `api/`. Keep each route folder self-contained.
- `src/components` (shadcn/ui in `components/ui`), `src/hooks`, `src/lib`, `src/config`,
  `src/types` — shared UI, data hooks, clients, boot configuration, contracts.
- `src/lib/excel/` — the Excel column spec, parser, and template builder.
  `sales-columns.json` is the single source of truth for the sheet; never redeclare headers.
- `supabase/migrations/` — `001`–`020` up, `rollback/` down.
  `supabase/seed/` — manual-only seed data, deliberately outside the migration path.
- `scripts/` — generators and verification scripts.
- `wiki/` — committed documentation. `docs/` — working notes, **git-ignored**.
- `public/` — static assets. User-generated media lives in Supabase Storage (bucket `rewards`).

## Build and development

```bash
npm run dev            # Turbopack dev server, http://localhost:3000
npm run build          # production build
npm run build:analyze  # ANALYZE=true
npm start              # serve the compiled build
npx tsc --noEmit       # typecheck — run before claiming done
```

## Code style

TypeScript-first, strict typing in services and server components. 2-space indent.
Components and hooks PascalCase (`AdminSidebar.tsx`); hooks `useX`; utilities plain `*.ts`.
`'use client'` only where browser APIs are needed. Tailwind CSS 4; group classes layout → colour →
state. Path alias `@/*` → `src/*`.

Comment the *why* — constraint rationale, security reasoning, traps. Not what the line does.

## Patterns

Guard every admin endpoint with `requirePermission` and map thrown errors to 401/403.
Hiding a menu item is not security.

`.select()` must be one string literal; concatenation breaks supabase-js type inference.

Use `.in()` for exact matching, never `.or(col.ilike."value")` — `ilike` treats `%` and `_` as
wildcards and PostgREST exposes no `ESCAPE`.

All balance changes go through Postgres RPC. Never `UPDATE points_balance` from a route.
Actor ids come from the session, never from a request body.
LINE push is fire-and-forget and must never fail the admin action.

## Testing

No test framework. Verification is scripts, each exiting non-zero on failure — see
`wiki/11-verification.md`.

```bash
node scripts/test-parse-sales-batch.js   # parser, offline
node scripts/verify-schema.js            # live schema vs code
node scripts/verify-types.js             # database.types.ts vs live DB
node scripts/verify-demo-ready.js        # pilot ready to demo
node scripts/e2e-batch-flow.js           # ⚠️ writes to the DB; cleans up after itself
```

`TESTING_GUIDE.md` and `ADMIN_RBAC_TASKS.md` still describe the deleted OCR/receipt system.
Do not follow them.

## Commits and PRs

Conventional Commits, scoped: `feat(pilot):`, `fix(admin):`, `refactor:`.
The subject describes the behaviour change; the body carries reasoning and, where it matters, what is
deliberately *not* done.

**A commit message must describe what is actually in the commit.** A message claiming a security fix
that is not present tells every future reader the system is safer than it is.

A PR should include the behaviour change, screenshots for UI work, any migrations or scripts touched,
and which verification scripts were run with their results.

## Security and configuration

Every environment variable is validated at boot by `src/config/env.ts` with **no defaults** —
see `wiki/07-environment-and-deployment.md` for the list.

`SUPABASE_SERVICE_ROLE_KEY` is server-only; keep server clients in `src/lib/supabase-server.ts` or
inside API routes. Never edit or commit `.env.local`. Never put a real phone number or a real
person's name in the repository.

RLS is on for every table with no permissive policies. Confirm policies before adding a table.
