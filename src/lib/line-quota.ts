/**
 * LINE message quota — อ่านจาก Messaging API แล้ว cache ลง line_quota_cache (แถวเดียว id=1)
 *
 *   GET /v2/bot/message/quota              → { type: 'limited', value } | { type: 'none' }
 *   GET /v2/bot/message/quota/consumption  → { totalUsage }
 *
 * MIGRATION_PLAN.md §6.2: cache 15 นาที — ไม่ทำ message_token_pool เอง
 * LINE ล้ม → คืน cache เดิม (stale=true) ไม่ throw ให้หน้า admin พัง
 */
import type { createServerSupabaseClient } from '@/lib/supabase-server'
import { serverEnv } from '@/config/env'

type Supabase = ReturnType<typeof createServerSupabaseClient>

export const QUOTA_CACHE_MAX_AGE_MS = 15 * 60 * 1000

export interface LineQuota {
  /** null = แผนไม่จำกัด (type 'none') */
  quota_limit: number | null
  consumed: number | null
  fetched_at: string
  /** true = ดึงจาก LINE ไม่สำเร็จ ค่าที่เห็นคือ cache เก่า */
  stale: boolean
}

async function lineGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.line.me/v2/bot${path}`, {
    headers: { Authorization: `Bearer ${serverEnv.LINE_CHANNEL_ACCESS_TOKEN}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`LINE ${path} → ${res.status}: ${await res.text()}`)
  return (await res.json()) as Record<string, unknown>
}

/** ดึงสดจาก LINE แล้วเขียน cache — ใช้จาก cron หรือเมื่อ cache หมดอายุ */
export async function refreshLineQuota(supabase: Supabase): Promise<LineQuota> {
  const [quota, consumption] = await Promise.all([lineGet('/message/quota'), lineGet('/message/quota/consumption')])
  const quota_limit = quota.type === 'limited' && typeof quota.value === 'number' ? quota.value : null
  const consumed = typeof consumption.totalUsage === 'number' ? consumption.totalUsage : null
  const fetched_at = new Date().toISOString()

  const { error } = await supabase.from('line_quota_cache').upsert({ id: 1, quota_limit, consumed, fetched_at })
  if (error) console.error('[line-quota] cache write failed:', error.message)

  return { quota_limit, consumed, fetched_at, stale: false }
}

/** cache ถ้ายังไม่เกิน maxAgeMs · ไม่งั้นดึงใหม่ · LINE ล้มคืน cache เดิม (stale) */
export async function getLineQuota(supabase: Supabase, maxAgeMs = QUOTA_CACHE_MAX_AGE_MS): Promise<LineQuota | null> {
  const { data: cached } = await supabase.from('line_quota_cache').select('*').eq('id', 1).maybeSingle()
  const fresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < maxAgeMs
  if (cached && fresh) {
    return { quota_limit: cached.quota_limit, consumed: cached.consumed, fetched_at: cached.fetched_at, stale: false }
  }
  try {
    return await refreshLineQuota(supabase)
  } catch (err) {
    console.error('[line-quota] refresh failed:', err)
    if (!cached) return null
    return { quota_limit: cached.quota_limit, consumed: cached.consumed, fetched_at: cached.fetched_at, stale: true }
  }
}
