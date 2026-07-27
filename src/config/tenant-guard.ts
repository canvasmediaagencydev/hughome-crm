/**
 * Tenant guard — MIGRATION_PLAN.md §9.1
 *
 * Verifies at server boot that the connected database belongs to the same
 * tenant as the env config (TENANT.code), preventing a mis-deploy where one
 * branch's build is pointed at another branch's database.
 *
 * Resilience (updated): startup must not brick the whole app. Only a DEFINITE
 * mismatch (DB has a tenant_code and it differs from env) is treated as fatal
 * and thrown — and even that is caught by instrumentation.ts and logged rather
 * than crashing every route. A read failure / missing row is logged loudly but
 * NOT fatal (a transient DB blip shouldn't take the whole app down).
 */
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TENANT } from './tenant'

let verified = false

export async function assertTenantMatchesDatabase(): Promise<void> {
  if (typeof window !== 'undefined') return
  if (verified) return

  let expected: string
  try {
    expected = TENANT.code
  } catch (e) {
    console.error('🚨 [tenant-guard] อ่าน env TENANT.code ไม่ได้ (ข้าม, ไม่ crash):', e instanceof Error ? e.message : e)
    return
  }

  let dbCode: string | null = null
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'tenant_code')
      .maybeSingle()
    if (error) {
      console.error(`🚨 [tenant-guard] อ่าน app_config.tenant_code ไม่ได้ (ข้าม, ไม่ crash): ${error.message}`)
      return
    }
    dbCode = data?.value ?? null
  } catch (e) {
    console.error('🚨 [tenant-guard] query app_config ล้มเหลว (ข้าม, ไม่ crash):', e instanceof Error ? e.message : e)
    return
  }

  if (dbCode === null) {
    console.error('🚨 [tenant-guard] ไม่พบ app_config.tenant_code (ยัง seed? หรือ service_role อ่านไม่ได้) — ข้าม, ไม่ crash')
    return
  }

  if (dbCode !== expected) {
    // The dangerous case — a real wrong-branch connection.
    throw new Error(
      `[tenant-guard] ❌ tenant ไม่ตรงกัน: env TENANT.code='${expected}' แต่ DB app_config.tenant_code='${dbCode}' — อาจต่อฐานผิดสาขา`,
    )
  }

  verified = true
  console.log(`✅ [tenant-guard] tenant ตรง: ${expected}`)
}
