import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { subDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

// NOTE: "receipts" no longer exist in the new model. The old dashboard metric
// shape is preserved but sourced from the real tables:
//   totalReceipts   → committed batches (point_batches)
//   pendingReceipts → redemptions not yet delivered (redemptions)
//   rejectedReceipts→ voided batches
//   totalReceiptValue → total points handed out (point_batch_ledger)
// The receipt time-series chart + recent-receipts table were removed (Sprint 3),
// so `analytics` and `recentReceipts` are returned empty. Values are all 0 until
// real data exists — that is correct. The admin dashboard is rebuilt in Sprint 9.
export async function GET(request: Request) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW)

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'all'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const daysParam = searchParams.get('days')

    const supabase = createServerSupabaseClient()
    const now = new Date()

    // Date range applies only to the "new users in range" metric.
    let startRangeISO: string | null = null
    let endRangeISO: string | null = null
    if (startDateParam && endDateParam) {
      startRangeISO = startOfDay(parseISO(startDateParam)).toISOString()
      endRangeISO = endOfDay(parseISO(endDateParam)).toISOString()
    } else if (daysParam) {
      const days = Math.min(Math.max(parseInt(daysParam), 1), 90)
      startRangeISO = startOfDay(subDays(now, days - 1)).toISOString()
      endRangeISO = endOfDay(now).toISOString()
    }

    const [
      allUsers,
      newUsersInRangeRes,
      committedBatches,
      voidedBatches,
      pendingPickups,
      ledger,
      activeRewardsCount,
      pendingRedemptionsCount,
      pointSettings,
    ] = await Promise.all([
      (() => {
        let q = supabase.from('user_profiles').select('role')
        if (role !== 'all') q = q.eq('role', role)
        return q
      })(),
      (() => {
        let q = supabase.from('user_profiles').select('id', { count: 'exact', head: true })
        if (role !== 'all') q = q.eq('role', role)
        if (startRangeISO && endRangeISO) q = q.gte('created_at', startRangeISO).lte('created_at', endRangeISO)
        return q
      })(),
      supabase.from('point_batches').select('*', { count: 'exact', head: true }).eq('status', 'committed'),
      supabase.from('point_batches').select('*', { count: 'exact', head: true }).eq('status', 'voided'),
      supabase.from('redemptions').select('*', { count: 'exact', head: true }).not('status', 'in', '(delivered,cancelled)'),
      supabase.from('point_batch_ledger').select('points_earned'),
      supabase.from('rewards').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('redemptions').select('*', { count: 'exact', head: true }).eq('status', 'requested'),
      supabase.from('point_settings').select('*').order('created_at', { ascending: false }),
    ])

    if (allUsers.error) throw allUsers.error
    if (pointSettings.error) throw pointSettings.error

    const users = allUsers.data || []
    const totalUsers = users.length
    const contractorCount = role === 'all'
      ? users.filter((u: any) => u.role === 'contractor').length
      : (role === 'contractor' ? totalUsers : 0)
    const homeownerCount = role === 'all'
      ? users.filter((u: any) => u.role === 'homeowner').length
      : (role === 'homeowner' ? totalUsers : 0)

    const totalValue = (ledger.data || []).reduce((sum: number, r: any) => sum + (r.points_earned || 0), 0)

    return buildResponse({
      totalUsers,
      contractorCount,
      homeownerCount,
      newUsersInRange: newUsersInRangeRes.count || 0,
      totalReceipts: committedBatches.count || 0,
      pendingReceipts: pendingPickups.count || 0,
      approvedCount: committedBatches.count || 0,
      rejectedReceipts: voidedBatches.count || 0,
      totalValue,
      activeRewards: activeRewardsCount.count || 0,
      pendingRedemptions: pendingRedemptionsCount.count || 0,
      pointSettings: pointSettings.data || [],
    }, [], [])

  } catch (error: any) {
    console.error("Dashboard API error:", error);
    if (typeof error?.message === 'string') {
      if (error.message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message.includes('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}

function buildResponse(metrics: any, recentReceipts: any[], analytics: any[]) {
  return NextResponse.json(
    {
      metrics: {
        totalUsers: metrics.totalUsers,
        contractorCount: metrics.contractorCount,
        homeownerCount: metrics.homeownerCount,
        monthlyActiveUsers: metrics.newUsersInRange,
        totalReceipts: metrics.totalReceipts,
        pendingReceipts: metrics.pendingReceipts,
        approvedReceipts: metrics.approvedCount,
        rejectedReceipts: metrics.rejectedReceipts,
        totalReceiptValue: metrics.totalValue,
        activeRewards: metrics.activeRewards,
        pendingRedemptions: metrics.pendingRedemptions,
        totalPointsEarned: 0,
        totalPointsSpent: 0,
        averageProcessingTime: 0,
        pointSettings: metrics.pointSettings,
      },
      recentReceipts,
      analytics,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  )
}
