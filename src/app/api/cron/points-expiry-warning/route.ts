/**
 * GET /api/cron/points-expiry-warning — เตือนลูกค้าแต้มใกล้หมดอายุ ทาง SMS (รันทุกวัน 09:00 ไทย)
 *
 * ประชุมลูกค้า 2026-10-21: แจ้งเตือนผู้ใช้งาน "เฉพาะแต้มจะหมดอายุ" และ "ผ่าน SMS" เท่านั้น
 * (เดิมเป็น LINE push — ปิดอยู่ตาม Q7 จึงไม่เคยถึงลูกค้า)
 *
 * อ่านอย่างเดียว + SMS · ไม่แตะแต้ม
 * ลูกค้าตกลง (2026-10-21): เตือน "ก่อนหมดอายุ 30 วัน ครั้งเดียว"
 * หา lot ที่ points_remaining > 0 และ expires_at อยู่ใน [วันนี้, วันนี้ + 30 วัน]
 * รันทุกวัน → lot ถูกเตือนวันแรกที่เข้าหน้าต่าง 30 วัน = 30 วันก่อนหมดพอดี
 * (lot ที่เหลือน้อยกว่า 30 วันอยู่แล้วตอนเปิดใช้ครั้งแรก จะถูกเตือนในรอบแรก)
 * dedupe ต่อ (user, expires_at ของ lot) ด้วย kind 'expiry_warning_sms' (migration 029):
 * lot วันหมดอายุเดิมเตือนครั้งเดียว — รอบถัดไปไม่ส่งซ้ำ
 * ถ้าคนเดียวมีหลายวันหมดอายุที่ยังไม่เคยเตือนในรอบเดียวกัน → รวมเป็น SMS เดียว (แต้มรวม · วันที่ใกล้สุด)
 * แล้ว log ทุกวันที่ในข้อความนั้น · lot จากคนละชุดที่หมดคนละวันได้ SMS แยกกัน (ชุดละครั้ง)
 *
 * ยังไม่ตั้ง THAIBULKSMS_SMS_* → 500 ทั้งรอบ (Vercel เห็นว่า cron ล้ม) ไม่ข้ามเงียบ
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { assertSmsConfigured, sendSms } from '@/lib/thaibulksms-sms'
import { addDays, formatThaiDate, todayBangkok } from '@/lib/bangkok-date'
import { loadSentKeys, logSent, sentKey } from '@/lib/notification-log'
import { normalizeThaiPhone } from '@/lib/phone'
import { TENANT } from '@/config/tenant'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOOKAHEAD_DAYS = 30
const KIND = 'expiry_warning_sms' as const

/** ข้อความ SMS — สั้นให้อยู่ใน 1–2 segment (ภาษาไทย 70 ตัวอักษรต่อ segment) */
function expiryMessage(points: number, expiresOn: string): string {
  return `${TENANT.name}: ${points.toLocaleString('en-US')} แต้มของคุณจะหมดอายุ ${formatThaiDate(expiresOn)} แลกของรางวัลใน LINE ก่อนหมดอายุ`
}

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    assertSmsConfigured()
  } catch (e) {
    console.error('[CRON expiry-warning]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'SMS is not configured' }, { status: 500 })
  }

  const supabase = createServerSupabaseClient()
  const today = todayBangkok()
  const horizon = addDays(today, LOOKAHEAD_DAYS)

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
    skipped_no_phone: 0,
    sms_failed: 0,
  }
  if (userIds.length === 0) return NextResponse.json(summary)

  const users: { id: string; phone: string | null }[] = []
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error: uErr } = await supabase.from('user_profiles').select('id, phone').in('id', userIds.slice(i, i + 200))
    if (uErr) {
      console.error('[CRON expiry-warning] users query failed:', uErr)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    users.push(...(data ?? []))
  }
  const sent = await loadSentKeys(supabase, KIND, userIds)

  for (const u of users) {
    const dates = perUser.get(u.id)
    if (!dates) continue
    const unsent = [...dates.entries()].filter(([d]) => !sent.has(sentKey(u.id, d))).sort(([a], [b]) => (a < b ? -1 : 1))
    if (unsent.length === 0) {
      summary.skipped_dedupe++
      continue
    }
    const phone = normalizeThaiPhone(u.phone)
    if (!phone) {
      summary.skipped_no_phone++
      continue
    }

    const pointsExpiring = unsent.reduce((s, [, p]) => s + p, 0)
    const earliest = unsent[0][0]
    const ok = await sendSms(phone, expiryMessage(pointsExpiring, earliest))
    if (ok) {
      summary.notified++
      await logSent(
        supabase,
        KIND,
        unsent.map(([d, p]) => ({ user_id: u.id, window_key: d, payload: { points: p, warned_on: today, channel: 'sms' } }))
      )
    } else {
      summary.sms_failed++
    }
  }

  return NextResponse.json(summary)
}
