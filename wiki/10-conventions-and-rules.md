# 10 — Conventions & rules

## Hard rules

From `docs/PROMPTS.md`, applied throughout the project.

- **No fallback or default for any config or env value.** Throw instead.
- **Never touch `.env.local`.** It holds live pilot credentials.
- **Never run a migration or write to Supabase without asking.** Write the `.sql`, hand it over.
- **Never edit migrations `001`–`022`.** They are applied. A change means a new file.
- **Never `npm install` / `uninstall` without asking.**
- **Never `git commit` or `git push` unless told to.**
- **No real phone numbers or real people's names in the repository.**
- **Do not change `src/lib/excel/sales-columns.json` without asking.** Sales staff hold templates
  built from that spec.
- **A business decision stops the work.** Ask; do not guess.
- **If `MIGRATION_PLAN.md` contradicts the code, stop and report.** Do not silently rewrite the plan.
- **Stay inside the current sprint's scope.**

## Code style

TypeScript-first, strict. 2-space indent. Components and hooks are PascalCase
(`AdminSidebar.tsx`); hooks are `useX`; utilities are plain `*.ts`.
`'use client'` only where browser APIs are genuinely needed.
Tailwind CSS 4; shadcn/ui components live in `src/components/ui`.
Path alias `@/*` → `src/*`.

Comments are written where a reader would otherwise ask "why is this like this" — constraint
rationale, security reasoning, and traps. Not narration of what the line does.

## Patterns to follow

**API route shape.** Guard first, then work, then map errors:

```ts
const admin = await requirePermission(PERMISSIONS.BATCHES_COMMIT)
// ...
const message = error instanceof Error ? error.message : ''
if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
if (message.startsWith('Forbidden'))    return NextResponse.json({ error: 'Forbidden' },    { status: 403 })
```

**Supabase `.select()` must be a single string literal.** Concatenating breaks type inference and
produces `GenericStringError`:

```ts
.select('id, file_name, week_start')                 // ✅
.select('id, ' + 'file_name')                        // ❌
```

**Chunk `.in()` queries.** `CHUNK = 200` is used for phone lookups; long URLs break PostgREST.

**Never `.or(col.ilike."value")` for exact matching.** `ilike` treats `%` and `_` as wildcards and
PostgREST exposes no `ESCAPE`. Use `.in()`, which supabase-js escapes properly.

**Money moves only through RPC.** Never `UPDATE points_balance` from an API route.

**Actor ids come from the session**, never from a request body.

**LINE push is fire-and-forget.** It must never fail the admin action.

## Error messages

User-facing errors are Thai, and say what to do next rather than what went wrong internally. When an
operation is atomic, say so — "no points went to anyone" is the first thing an operator needs to know
after a failed commit.

Include the actual values: `ยอดลดหนี้ (1500) มากกว่ายอดซื้อ (1200)` beats "invalid amount".

## Commits

Conventional Commits, scoped: `feat(pilot):`, `fix(admin):`, `refactor:`.
The body describes the behaviour change and, where it is not obvious, the reasoning.

**A commit message must describe what is actually in the commit.** This has already been a live
issue: a proposed message claimed `tenant-guard fails closed on mismatch` when no tenant-guard change
was staged. Merging that would have told every future reader that a security control existed when it
did not.

State what is *not* done in the body when it matters.

## Testing

There is no test framework. Verification is scripts, each exiting non-zero on failure — see
[11 — Verification](11-verification.md). Run `npx tsc --noEmit` and the relevant script before
claiming anything works.

Prefer verification that touches the real thing: parsing a real `.xlsx`, calling the real RPC against
the real database with data that cleans itself up afterwards. Parse-checking SQL proves syntax only —
it does not execute a `plpgsql` body.

## Documentation layout

| Location | Contents | In git? |
|---|---|---|
| `CLAUDE.md` | AI entry point: objectives, hard rules, current state | ✅ |
| `README.md` | human entry point | ✅ |
| `AGENTS.md` | repository conventions | ✅ |
| `wiki/` | architecture, data model, flows, runbooks, roadmap | ✅ |
| `MIGRATION_PLAN.md` | the original decision record, authoritative on *why* | ✅ |
| `supabase/README.md` | migration runbook | ✅ |
| `docs/` | working notes, sprint prompts, demo assets | ❌ git-ignored |

Anything an agent must read from a fresh clone belongs outside `docs/`.
