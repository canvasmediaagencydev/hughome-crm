/**
 * Next.js instrumentation — runs once when a server instance boots (NOT during
 * `next build`, and NOT in the browser). Runs the tenant guard at startup
 * (MIGRATION_PLAN.md §9.1).
 *
 * IMPORTANT: startup instrumentation must NEVER crash the whole app. Any error
 * here is caught and logged — a wrong-branch tenant is surfaced as a loud log
 * (see tenant-guard), not a blanket 500 on every route.
 */
export async function register() {
  // Node.js server runtime only (skip edge runtime and the build phase).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  try {
    const { assertTenantMatchesDatabase } = await import('@/config/tenant-guard')
    await assertTenantMatchesDatabase()
  } catch (e) {
    console.error(
      '🚨 [instrumentation] tenant-guard failed (non-fatal — app continues):',
      e instanceof Error ? e.message : e,
    )
  }
}
