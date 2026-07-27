/**
 * Next.js instrumentation — runs once when a server instance boots (NOT during
 * `next build`, and NOT in the browser). Used here to run the tenant guard at
 * startup so a wrong-branch DB connection refuses to boot (MIGRATION_PLAN.md §9.1).
 */
export async function register() {
  // Node.js server runtime only (skip edge runtime and the build phase).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { assertTenantMatchesDatabase } = await import('@/config/tenant-guard')
  await assertTenantMatchesDatabase()
}
