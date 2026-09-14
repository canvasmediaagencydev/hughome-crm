/**
 * notification_log (migration 022) — กัน LINE push ซ้ำต่อ (user, kind, window_key)
 *
 * รูปแบบใช้งานใน cron:
 *   1. loadSentKeys() ก่อนส่ง → ข้ามคนที่เคยส่ง window นี้แล้ว
 *   2. push สำเร็จค่อย logSent() — push ล้มไม่ log ให้รอบถัดไปลองใหม่
 * UNIQUE ใน DB เป็นตาข่ายชั้นสุดท้ายถ้า cron สองตัวรันชนกัน (23505 = ถือว่าส่งแล้ว)
 */
import type { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Json } from '../../database.types'

type Supabase = ReturnType<typeof createServerSupabaseClient>

export type NotificationKind = 'expiry_warning' | 'expiry_executed' | 'birthday'

export function sentKey(userId: string, windowKey: string): string {
  return `${userId}|${windowKey}`
}

/** key ที่เคยส่งแล้วของ kind นี้ — จำกัดด้วย userIds (ว่าง = ไม่ query) */
export async function loadSentKeys(
  supabase: Supabase,
  kind: NotificationKind,
  userIds: string[]
): Promise<Set<string>> {
  const keys = new Set<string>()
  if (userIds.length === 0) return keys
  // PostgREST `in` มีเพดาน URL — แบ่งเป็นก้อนละ 200
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const { data, error } = await supabase
      .from('notification_log')
      .select('user_id, window_key')
      .eq('kind', kind)
      .in('user_id', chunk)
    if (error) throw new Error(`notification_log read failed: ${error.message}`)
    for (const row of data ?? []) keys.add(sentKey(row.user_id, row.window_key))
  }
  return keys
}

export interface SentRow {
  user_id: string
  window_key: string
  payload?: Json
}

/** บันทึกว่าส่งแล้ว — 23505 (ซ้ำ) ไม่ถือเป็น error */
export async function logSent(supabase: Supabase, kind: NotificationKind, rows: SentRow[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('notification_log')
    .insert(rows.map((r) => ({ user_id: r.user_id, kind, window_key: r.window_key, payload: r.payload ?? null })))
  if (error && error.code !== '23505') {
    // ไม่ throw — ข้อความส่งไปแล้ว การ log ล้มไม่ควรทำให้ cron ทั้งตัว fail แต่ต้องเห็นใน log
    console.error(`[notification_log] insert failed (kind=${kind}):`, error.message)
  }
}
