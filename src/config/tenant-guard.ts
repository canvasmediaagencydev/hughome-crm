/**
 * Tenant guard — MIGRATION_PLAN.md §9.1
 *
 * Verifies at server boot that the connected database belongs to the same
 * tenant as the env config (TENANT.code). This prevents a catastrophic
 * mis-deploy where, e.g., the ฟ้าฮ่าม build is accidentally pointed at the
 * แม่ริม production database.
 *
 * Behavior (agreed):
 *   - env TENANT.code ≠ DB app_config.tenant_code  → ALWAYS refuse to boot
 *     (this is the dangerous "wrong branch" case).
 *   - DB has no tenant_code yet (not migrated/seeded) → warn in dev, refuse in
 *     production. Lets local dev run before migrations are applied.
 *
 * Server-only: reads via the service_role client. Throws if imported/run in the
 * browser so secrets never reach the client bundle.
 */
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TENANT } from './tenant'

let verified = false

export async function assertTenantMatchesDatabase(): Promise<void> {
  if (typeof window !== 'undefined') {
    throw new Error('[tenant-guard] must not run in the browser')
  }
  if (verified) return

  const isProd = process.env.NODE_ENV === 'production'
  const expected = TENANT.code

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'tenant_code')
    .maybeSingle()

  // Table/row not there yet (DB not migrated) — Postgres "undefined_table" (42P01)
  // surfaces as an error; a missing row surfaces as data === null.
  if (error) {
    const msg = `[tenant-guard] อ่าน app_config.tenant_code ไม่ได้ (ยัง apply migration?): ${error.message}`
    if (isProd) throw new Error(`${msg} — refuse to boot (production)`)
    console.warn(`⚠️  ${msg} — ข้ามชั่วคราว (dev)`)
    return
  }

  const dbCode = data?.value ?? null
  if (dbCode === null) {
    const msg = `[tenant-guard] ไม่พบ app_config.tenant_code (ยังไม่ได้ seed)`
    if (isProd) throw new Error(`${msg} — refuse to boot (production)`)
    console.warn(`⚠️  ${msg} — ข้ามชั่วคราว (dev)`)
    return
  }

  if (dbCode !== expected) {
    throw new Error(
      `[tenant-guard] ❌ tenant ไม่ตรงกัน — refuse to boot!\n` +
        `  env  TENANT.code            = '${expected}'\n` +
        `  DB   app_config.tenant_code = '${dbCode}'\n` +
        `  อาจกำลังต่อฐานข้อมูลผิดสาขา — ตรวจ .env.local / Supabase project ให้ตรงกัน`,
    )
  }

  verified = true
}
