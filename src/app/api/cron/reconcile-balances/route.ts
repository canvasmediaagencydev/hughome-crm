/**
 * GET /api/cron/reconcile-balances — ตรวจ invariant รายวัน (อ่านอย่างเดียว)
 *
 *   user_profiles.points_balance == SUM(point_batch_ledger.points_remaining)
 *
 * ผ่าน RPC reconcile_balances() (STABLE, migration 022) → คืนเฉพาะคนที่ไม่ตรง
 * บันทึกผลลง balance_reconcile_log ทุกครั้ง · ถ้าไม่ตรง: console.error + ตอบ 500
 * เพื่อให้ Vercel นับเป็น cron ล้มเหลว (= alert) · **ห้าม auto-fix** — เงินผิดต้องมีคนดู
 * (ซ่อมด้วยมือแบบ supabase/fixes/2026-09-13_reconcile_cancel_drift.sql)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyCronRequest } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  const [{ data: mismatches, error: rpcError }, { count: checked, error: countError }] = await Promise.all([
    supabase.rpc('reconcile_balances'),
    supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
  ])
  if (rpcError || countError) {
    console.error('[CRON reconcile] query failed:', rpcError ?? countError)
    return NextResponse.json({ error: (rpcError ?? countError)?.message }, { status: 500 })
  }

  const rows = mismatches ?? []
  const { error: logError } = await supabase.from('balance_reconcile_log').insert({
    checked_users: checked ?? 0,
    mismatch_count: rows.length,
    details: rows,
  })
  if (logError) console.error('[CRON reconcile] log insert failed:', logError)

  const body = {
    success: rows.length === 0,
    checked_users: checked ?? 0,
    mismatch_count: rows.length,
    mismatches: rows,
  }

  if (rows.length > 0) {
    // alert: ขึ้นเป็น cron failure ใน Vercel + log เต็มรูปแบบ · ไม่แก้อะไรเอง
    console.error(`[CRON reconcile] ⚠️ ${rows.length} user(s) with balance/ledger drift:`, JSON.stringify(rows))
    return NextResponse.json(body, { status: 500 })
  }
  return NextResponse.json(body)
}
