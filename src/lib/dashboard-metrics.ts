/**
 * ตัวเลขบน /admin (Sprint 9R A6) — ใช้ร่วมกันโดย /api/admin/dashboard/metrics และ /all
 *
 * ช่วงวันที่ (from/to · YYYY-MM-DD · ตามเวลาไทย) คุมเฉพาะตัวเลข "ในช่วง":
 *   newUsersInRange        ลูกค้าสมัครใหม่ (user_profiles.created_at)
 *   pointsIssuedInRange    แต้มออก = point_transactions type earned/bonus (batch อนุมัติ + ปรับมือบวก)
 *   pointsRedeemedInRange  แต้มแลก = point_transactions type spent (ค่าเป็นลบ · คืนเป็นบวก)
 *   batchesCommittedInRange ชุดที่แต้มเข้าในช่วง (committed_at)
 * ตัวเลข "ณ ตอนนี้" ไม่สนช่วง: ลูกค้าทั้งหมด, ชุดที่รอผู้อนุมัติ, รางวัลที่เปิด, คำขอแลกที่รอ
 *
 * ไม่มี metric ที่อ้าง receipts/OCR อีกแล้ว (wiki/12 §6)
 */
import type { createServerSupabaseClient } from '@/lib/supabase-server'
import { isIsoDate, todayBangkok } from '@/lib/bangkok-date'

type Supabase = ReturnType<typeof createServerSupabaseClient>

export interface DashboardMetricsPayload {
  range: { from: string; to: string }
  role: 'all' | 'contractor' | 'homeowner'
  totalUsers: number
  contractorCount: number
  homeownerCount: number
  newUsersInRange: number
  pendingApprovalBatches: number
  batchesCommittedInRange: number
  pointsIssuedInRange: number
  pointsRedeemedInRange: number
  activeRewards: number
  pendingRedemptions: number
  pointSettings: unknown[]
}

/** เดือนนี้ตามเวลาไทย — ค่าเริ่มต้นของหน้า /admin เมื่อไม่ส่ง from/to */
export function currentMonthRangeBangkok(): { from: string; to: string } {
  const today = todayBangkok()
  const [y, m] = today.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}` }
}

export function parseRange(sp: URLSearchParams): { from: string; to: string } | { error: string } {
  const from = sp.get('from')
  const to = sp.get('to')
  if (!from && !to) return currentMonthRangeBangkok()
  if (!isIsoDate(from) || !isIsoDate(to)) return { error: 'from และ to ต้องเป็น YYYY-MM-DD ทั้งคู่' }
  if (to < from) return { error: 'to ต้องไม่มาก่อน from' }
  return { from, to }
}

export function parseRole(sp: URLSearchParams): DashboardMetricsPayload['role'] | { error: string } {
  const role = sp.get('role') ?? 'all'
  if (role === 'all' || role === 'contractor' || role === 'homeowner') return role
  return { error: "role ต้องเป็น all | contractor | homeowner" }
}

/** ขอบเขตเวลาแบบ timestamptz ของช่วงวันที่ไทย: [from 00:00+07, to 24:00+07) */
function bounds(range: { from: string; to: string }) {
  const start = `${range.from}T00:00:00+07:00`
  const nextDay = new Date(Date.UTC(+range.to.slice(0, 4), +range.to.slice(5, 7) - 1, +range.to.slice(8, 10) + 1))
    .toISOString()
    .slice(0, 10)
  const endExclusive = `${nextDay}T00:00:00+07:00`
  return { start, endExclusive }
}

export async function computeDashboardMetrics(
  supabase: Supabase,
  range: { from: string; to: string },
  role: DashboardMetricsPayload['role']
): Promise<DashboardMetricsPayload> {
  const { start, endExclusive } = bounds(range)

  let newUsersQuery = supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', start)
    .lt('created_at', endExclusive)
  if (role !== 'all') newUsersQuery = newUsersQuery.eq('role', role)

  const [users, newUsers, pendingApproval, committedInRange, txIssued, txRedeemed, rewards, pendingRedemptions, pointSettings] =
    await Promise.all([
      supabase.from('user_profiles').select('role').not('role', 'is', null),
      newUsersQuery,
      supabase.from('point_batches').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      supabase
        .from('point_batches')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'committed')
        .gte('committed_at', start)
        .lt('committed_at', endExclusive),
      supabase
        .from('point_transactions')
        .select('points')
        .in('type', ['earned', 'bonus'])
        .gte('created_at', start)
        .lt('created_at', endExclusive)
        .limit(10000),
      supabase
        .from('point_transactions')
        .select('points')
        .eq('type', 'spent')
        .gte('created_at', start)
        .lt('created_at', endExclusive)
        .limit(10000),
      supabase.from('rewards').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('redemptions').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      supabase.from('point_settings').select('*').order('created_at', { ascending: false }),
    ])

  for (const r of [users, newUsers, pendingApproval, committedInRange, txIssued, txRedeemed, rewards, pendingRedemptions, pointSettings]) {
    if (r.error) throw r.error
  }

  const all = users.data ?? []
  const contractorCount = all.filter((u) => u.role === 'contractor').length
  const homeownerCount = all.filter((u) => u.role === 'homeowner').length
  const totalUsers = role === 'all' ? all.length : role === 'contractor' ? contractorCount : homeownerCount

  return {
    range,
    role,
    totalUsers,
    contractorCount,
    homeownerCount,
    newUsersInRange: newUsers.count ?? 0,
    pendingApprovalBatches: pendingApproval.count ?? 0,
    batchesCommittedInRange: committedInRange.count ?? 0,
    pointsIssuedInRange: (txIssued.data ?? []).reduce((n, t) => n + Math.max(0, t.points), 0),
    // spent เก็บเป็นลบ → กลับเครื่องหมายให้เป็นจำนวนแต้มที่แลก
    pointsRedeemedInRange: (txRedeemed.data ?? []).reduce((n, t) => n + Math.max(0, -t.points), 0),
    activeRewards: rewards.count ?? 0,
    pendingRedemptions: pendingRedemptions.count ?? 0,
    pointSettings: pointSettings.data ?? [],
  }
}

export const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  Pragma: 'no-cache',
  Expires: '0',
}
