# Repository Guidelines

## Project Structure & Module Organization
- `src/app` hosts the Next.js App Router routes (admin dashboards, LIFF flows, API routes). Keep each route folder self-contained with `page.tsx`, `layout.tsx`, and supporting server actions.
- `src/components`, `src/hooks`, `src/services`, `src/lib`, `src/utils`, and `src/types` contain reusable UI, data hooks, Supabase/LINE clients, helpers, and shared contracts. Favor colocating admin-only helpers under `src/lib/admin-*` when they need privileged tokens.
- Persistent assets live under `public/`; Supabase buckets store user-generated media. Product docs and flows live in `docs/` (notably `docs/architecture.md` and the PRD series). Seed and maintenance jobs reside under `scripts/`.

## Build, Test, and Development Commands
- `npm run dev` starts the Turbopack-powered dev server at `http://localhost:3000`; use when iterating on UI or API routes.
- `npm run build` (or `npm run build:analyze` with `ANALYZE=true`) compiles the production bundle; run before proposing deployments.
- `npm run start` serves the compiled build locally to mimic Vercel. Pair with production-like env vars when verifying Supabase/LINE flows.
- `node scripts/create-test-admin.js` (or `create-test-admins.js`) provisions RBAC fixtures that match `TESTING_GUIDE.md`.

## Coding Style & Naming Conventions
- Codebase is TypeScript-first; keep strict typing in services and React Server Components. Components and hooks use PascalCase (e.g., `AdminSidebar.tsx`), hooks use `useX` convention, utility modules use `*.ts`.
- Follow 2-space indentation from existing files. Favor functional, client-annotated components only when browser APIs are required (`'use client'`).
- Styling runs through Tailwind CSS 4 presets; group class names by layout → color → state. Share variants via `class-variance-authority` utilities under `src/lib`.

## Testing Guidelines
- Automated coverage is limited; rely on the RBAC scenarios documented in `TESTING_GUIDE.md`. Work through the Super Admin, Receipt Manager, Customer Support, and Reward Manager checklists after any permission, OCR, or admin UI change.
- When backend permissions change, run the cURL smoke tests in `TESTING_GUIDE.md` to confirm `403`/`200` expectations, then exercise the admin UI to ensure menus honor role filters.
- Record any new manual scenario directly inside `TESTING_GUIDE.md` or link to issue-specific notes.

## Commit & Pull Request Guidelines
- Follow the conventional style in `git log` (`feat(admin): ...`, `fix(admin): ...`, `refactor:`). Scope reflects the surface (`admin`, `receipts`, `ocr`), and the subject should describe the behavior change.
- Each PR should include: summary of behavior change, screenshots/GIFs for UI updates, references to Supabase migrations or scripts touched, linked Jira/GitHub issue, and a checklist of manual tests executed.

## Security & Configuration Tips
- Required env vars include `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, LINE LIFF credentials, and storage bucket names. Never expose the service role key to client code; keep server-only clients in `src/lib/supabase-server.ts` or API routes.
- Confirm RLS policies before deploying migrations. When testing locally, load `.env.local` and avoid committing secrets.
