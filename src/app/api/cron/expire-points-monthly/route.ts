/**
 * GET /api/cron/expire-points-monthly — ตัดแต้มที่หมดอายุ (step-wise ต่อ lot)
 *
 * เงินขยับใน RPC expire_ledger_batches(p_as_of) เท่านั้น: lot ที่ expires_at < as_of
 * → points_remaining = 0 (แถวไม่ถูกลบ เก็บเป็นประวัติ) · points_balance ลด · point_transactions 'expired'
 * ห้าม UPDATE points_balance / points_remaining จากที่นี่
 *
 * as_of = วันนี้ตาม Asia/Bangkok — เหมือน redeem_reward ที่นับ lot "ยังใช้ได้" เมื่อ expires_at >= วันนี้
 * ตั้ง schedule รายวัน (idempotent — วันที่ไม่มี lot หมดอายุจะได้ 0): ถ้ารอถึงวันที่ 1 ของเดือน
 * lot ที่หมดอายุกลางเดือน (ปีอธิกสุรทินทำให้ +365 ไม่ตรงสิ้นเดือน) จะค้างใน balance
 * แต่ redeem หักไม่ได้ → ลูกค้าเจอ "ledger/balance mismatch" ตอนแลก
 *
 * LINE push "แต้มหมดอายุแล้ว" fire-and-forget + dedupe (kind expiry_executed, key = as_of)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyCronRequest } from '@/lib/cron-auth'
import { notifyExpiryExecuted } from '@/lib/line-messaging'
import { todayBangkok } from '@/lib/bangkok-date'
import { loadSentKeys, logSent, sentKey } from '@/lib/notification-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()
  const asOf = todayBangkok()
  // ขอบล่างสำหรับดึง transaction ที่ RPC รอบนี้เพิ่งเขียน (เผื่อ clock ต่างกันเล็กน้อย)
  const startedAt = new Date(Date.now() - 5_000).toISOString()

  const { data: expiredTotal, error: rpcError } = await supabase.rpc('expire_ledger_batches', { p_as_of: asOf })
  if (rpcError) {
    console.error('[CRON expire] expire_ledger_batches failed:', rpcError)
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  const summary = {
    success: true,
    as_of: asOf,
    expired_points: expiredTotal ?? 0,
    users_affected: 0,
    notified: 0,
    skipped_dedupe: 0,
    push_failed: 0,
  }
  if (!expiredTotal) return NextResponse.json(summary)

  // ---------- LINE push (ทุกอย่างหลังจากนี้ล้มได้โดยไม่กระทบแต้มที่ตัดไปแล้ว) ----------
  try {
    const { data: txns, error: txErr } = await supabase
      .from('point_transactions')
      .select('user_id, points')
      .eq('type', 'expired')
      .eq('source', 'expiry')
      .gte('created_at', startedAt)
    if (txErr) throw txErr

    const byUser = new Map<string, number>()
    for (const t of txns ?? []) byUser.set(t.user_id, (byUser.get(t.user_id) ?? 0) + Math.abs(t.points))
    summary.users_affected = byUser.size
    const userIds = [...byUser.keys()]

    const [{ data: users }, { data: nextLots }, sent] = await Promise.all([
      supabase.from('user_profiles').select('id, line_user_id, points_balance').in('id', userIds),
      supabase
        .from('point_batch_ledger')
        .select('user_id, expires_at')
        .in('user_id', userIds)
        .gt('points_remaining', 0)
        .gte('expires_at', asOf)
        .order('expires_at', { ascending: true }),
      loadSentKeys(supabase, 'expiry_executed', userIds),
    ])

    const nextExpiry = new Map<string, string>()
    for (const lot of nextLots ?? []) if (!nextExpiry.has(lot.user_id)) nextExpiry.set(lot.user_id, lot.expires_at)

    for (const u of users ?? []) {
      if (!u.line_user_id) continue
      if (sent.has(sentKey(u.id, asOf))) {
        summary.skipped_dedupe++
        continue
      }
      const expiredPoints = byUser.get(u.id) ?? 0
      const next = nextExpiry.get(u.id)
      const ok = await notifyExpiryExecuted(u.line_user_id, {
        expiredPoints,
        newBalance: u.points_balance ?? 0,
        nextExpireAt: next ? new Date(`${next}T00:00:00+07:00`) : null,
      })
      if (ok) {
        summary.notified++
        await logSent(supabase, 'expiry_executed', [
          { user_id: u.id, window_key: asOf, payload: { expired_points: expiredPoints, next_expires_at: next ?? null } },
        ])
      } else {
        summary.push_failed++
      }
    }
  } catch (err) {
    console.error('[CRON expire] notification phase failed (points already expired correctly):', err)
  }

  return NextResponse.json(summary)
}
