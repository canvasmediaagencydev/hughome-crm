/**
 * GET /api/cron/points-expiry-warning — เตือนล่วงหน้า 1–3 เดือน (รันวันที่ 1 ของเดือน)
 *
 * อ่านอย่างเดียว + LINE push · ไม่แตะแต้ม
 * หา lot ที่ points_remaining > 0 และ expires_at อยู่ใน [วันนี้, วันนี้ + 3 เดือน]
 * dedupe ต่อ (user, expires_at ของ lot): lot วันหมดอายุเดิมเตือนครั้งเดียว — รอบถัดไปไม่ส่งซ้ำ
 * ถ้าคนเดียวมีหลายวันหมดอายุที่ยังไม่เคยเตือน → รวมเป็นข้อความเดียว (แต้มรวม · วันที่ใกล้สุด)
 * แล้ว log ทุกวันที่ในข้อความนั้น
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { notifyExpiryWarning } from '@/lib/line-messaging'
import { addMonths, daysBetween, todayBangkok } from '@/lib/bangkok-date'
import { loadSentKeys, logSent, sentKey } from '@/lib/notification-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOOKAHEAD_MONTHS = 3

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const today = todayBangkok()
  const horizon = addMonths(today, LOOKAHEAD_MONTHS)

  const { data: lots, error } = await supabase
    .from('point_batch_ledger')
    .select('user_id, points_remaining, expires_at')
    .gt('points_remaining', 0)
    .gte('expires_at', today)
    .lte('expires_at', horizon)
  if (error) {
    console.error('[CRON expiry-warning] ledger query failed:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  // user → (expires_at → points)
  const perUser = new Map<string, Map<string, number>>()
  for (const lot of lots ?? []) {
    const dates = perUser.get(lot.user_id) ?? new Map<string, number>()
    dates.set(lot.expires_at, (dates.get(lot.expires_at) ?? 0) + lot.points_remaining)
    perUser.set(lot.user_id, dates)
  }
  const userIds = [...perUser.keys()]

  const summary = {
    success: true,
    date: today,
    horizon,
    users_with_expiring_lots: userIds.length,
    notified: 0,
    skipped_dedupe: 0,
    skipped_no_line: 0,
    push_failed: 0,
  }
  if (userIds.length === 0) return NextResponse.json(summary)

  const [{ data: users, error: uErr }, sent] = await Promise.all([
    supabase.from('user_profiles').select('id, line_user_id, points_balance').in('id', userIds),
    loadSentKeys(supabase, 'expiry_warning', userIds),
  ])
  if (uErr) {
    console.error('[CRON expiry-warning] users query failed:', uErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  for (const u of users ?? []) {
    const dates = perUser.get(u.id)
    if (!dates) continue
    const unsent = [...dates.entries()].filter(([d]) => !sent.has(sentKey(u.id, d))).sort(([a], [b]) => (a < b ? -1 : 1))
    if (unsent.length === 0) {
      summary.skipped_dedupe++
      continue
    }
    if (!u.line_user_id) {
      summary.skipped_no_line++
      continue
    }

    const pointsExpiring = unsent.reduce((s, [, p]) => s + p, 0)
    const earliest = unsent[0][0]
    const ok = await notifyExpiryWarning(u.line_user_id, {
      pointsExpiring,
      expireAt: new Date(`${earliest}T00:00:00+07:00`),
      daysLeft: daysBetween(today, earliest),
      pointsBalance: u.points_balance ?? 0,
    })
    if (ok) {
      summary.notified++
      await logSent(
        supabase,
        'expiry_warning',
        unsent.map(([d, p]) => ({ user_id: u.id, window_key: d, payload: { points: p, warned_on: today } }))
      )
    } else {
      summary.push_failed++
    }
  }

  return NextResponse.json(summary)
}
