import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  subDays, startOfDay, endOfDay,
  eachDayOfInterval, eachMonthOfInterval,
  format, parseISO, differenceInDays
} from "date-fns";
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function GET(request: Request) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW)

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role') || 'all'
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const daysParam = searchParams.get('days')

    const supabase = createServerSupabaseClient();
    const now = new Date();

    // Resolve date range
    let startRangeISO: string
    let endRangeISO: string
    let isAllTime = false
    let useMonthlyGrouping = false

    if (startDateParam && endDateParam) {
      // Custom range
      startRangeISO = startOfDay(parseISO(startDateParam)).toISOString()
      endRangeISO = endOfDay(parseISO(endDateParam)).toISOString()
      const diffDays = differenceInDays(parseISO(endDateParam), parseISO(startDateParam))
      useMonthlyGrouping = diffDays > 60
    } else if (daysParam) {
      // Preset range
      const days = Math.min(Math.max(parseInt(daysParam), 1), 90)
      startRangeISO = startOfDay(subDays(now, days - 1)).toISOString()
      endRangeISO = endOfDay(now).toISOString()
    } else {
      // All time — chart shows last 12 months
      isAllTime = true
      useMonthlyGrouping = true
      startRangeISO = startOfDay(subDays(now, 364)).toISOString()
      endRangeISO = endOfDay(now).toISOString()
    }

    // Role filter: pre-fetch matching user IDs
    let roleUserIds: string[] | null = null
    if (role !== 'all') {
      const { data: roleUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', role)
      roleUserIds = roleUsers?.map((u: { id: string }) => u.id) || []
    }

    const applyRoleFilter = (query: any) =>
      roleUserIds ? query.in('user_id', roleUserIds) : query

    // Apply optional date filter to a query (for metrics cards)
    const applyDateFilter = (query: any) =>
      isAllTime ? query : query.gte('created_at', startRangeISO).lte('created_at', endRangeISO)

    const [
      allUsers,
      allReceipts,
      activeRewardsCount,
      pendingRedemptionsCount,
      pointSettings,
      recentReceipts,
      analyticsUsers,
      analyticsReceipts,
      analyticsApprovedReceipts
    ] = await Promise.all([
      // Users — date-filtered unless all-time
      (() => {
        let q = supabase.from("user_profiles").select("role, created_at")
        if (role !== 'all') q = q.eq('role', role)
        if (!isAllTime) q = q.gte('created_at', startRangeISO).lte('created_at', endRangeISO)
        return q
      })(),

      // Receipts — date-filtered
      applyRoleFilter(
        applyDateFilter(supabase.from("receipts").select("status, total_amount, created_at"))
      ),

      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("status", "requested"),
      supabase.from("point_settings").select("*").order("created_at", { ascending: false }),

      // Recent receipts — date-filtered
      applyRoleFilter(
        applyDateFilter(
          supabase
            .from("receipts")
            .select(`*, user_profiles!receipts_user_id_fkey (id, display_name, first_name, last_name)`)
            .order("created_at", { ascending: false })
            .limit(10)
        )
      ),

      // Analytics: new users
      (() => {
        let q = supabase.from('user_profiles').select('created_at')
          .gte('created_at', startRangeISO).lte('created_at', endRangeISO)
        if (role !== 'all') q = q.eq('role', role)
        return q
      })(),

      // Analytics: receipts
      applyRoleFilter(
        supabase.from('receipts').select('created_at')
          .gte('created_at', startRangeISO).lte('created_at', endRangeISO)
      ),

      // Analytics: approved receipts + amounts
      applyRoleFilter(
        supabase.from('receipts').select('created_at, total_amount')
          .eq('status', 'approved')
          .gte('created_at', startRangeISO).lte('created_at', endRangeISO)
      ),
    ]);

    if (allUsers.error) throw allUsers.error;
    if (allReceipts.error) throw allReceipts.error;
    if (activeRewardsCount.error) throw activeRewardsCount.error;
    if (pendingRedemptionsCount.error) throw pendingRedemptionsCount.error;
    if (pointSettings.error) throw pointSettings.error;
    if (recentReceipts.error) throw recentReceipts.error;
    if (analyticsUsers.error) throw analyticsUsers.error;
    if (analyticsReceipts.error) throw analyticsReceipts.error;
    if (analyticsApprovedReceipts.error) throw analyticsApprovedReceipts.error;

    const users = allUsers.data || [];
    const receipts = allReceipts.data || [];

    const totalUsers = users.length;
    const contractorCount = role === 'all' ? users.filter(u => u.role === "contractor").length : (role === 'contractor' ? totalUsers : 0);
    const homeownerCount = role === 'all' ? users.filter(u => u.role === "homeowner").length : (role === 'homeowner' ? totalUsers : 0);
    const newUsersInRange = (analyticsUsers.data || []).length;

    const totalReceipts = receipts.length;
    const pendingReceipts = receipts.filter((r: any) => r.status === "pending").length;
    const approvedReceipts = receipts.filter((r: any) => r.status === "approved");
    const approvedCount = approvedReceipts.length;
    const rejectedReceipts = receipts.filter((r: any) => r.status === "rejected").length;
    const totalValue = approvedReceipts.reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);

    const bahtPerPoint = pointSettings.data?.find((s: any) => s.setting_key === 'baht_per_point')?.setting_value || 100;

    // Build chart intervals
    const startForChart = parseISO(startRangeISO)
    const endForChart = parseISO(endRangeISO)

    const usersByKey = new Map<string, number>();
    const receiptsByKey = new Map<string, number>();
    const pointsByKey = new Map<string, number>();

    if (useMonthlyGrouping) {
      const months = eachMonthOfInterval({ start: startForChart, end: endForChart })
      months.forEach(m => {
        const key = format(m, 'yyyy-MM')
        usersByKey.set(key, 0)
        receiptsByKey.set(key, 0)
        pointsByKey.set(key, 0)
      })

      analyticsUsers.data?.forEach((u: any) => {
        if (u.created_at) {
          const key = format(new Date(u.created_at), 'yyyy-MM')
          usersByKey.set(key, (usersByKey.get(key) || 0) + 1)
        }
      })
      analyticsReceipts.data?.forEach((r: any) => {
        if (r.created_at) {
          const key = format(new Date(r.created_at), 'yyyy-MM')
          receiptsByKey.set(key, (receiptsByKey.get(key) || 0) + 1)
        }
      })
      analyticsApprovedReceipts.data?.forEach((r: any) => {
        if (r.created_at) {
          const key = format(new Date(r.created_at), 'yyyy-MM')
          const pts = Math.floor((r.total_amount || 0) / bahtPerPoint)
          pointsByKey.set(key, (pointsByKey.get(key) || 0) + pts)
        }
      })

      const analyticsData = eachMonthOfInterval({ start: startForChart, end: endForChart }).map(m => ({
        date: format(m, 'MM/yy'),
        users: usersByKey.get(format(m, 'yyyy-MM')) || 0,
        receipts: receiptsByKey.get(format(m, 'yyyy-MM')) || 0,
        points: pointsByKey.get(format(m, 'yyyy-MM')) || 0,
      }))

      return buildResponse({ totalUsers, contractorCount, homeownerCount, newUsersInRange, totalReceipts, pendingReceipts, approvedCount, rejectedReceipts, totalValue, activeRewards: activeRewardsCount.count || 0, pendingRedemptions: pendingRedemptionsCount.count || 0, pointSettings: pointSettings.data || [] }, recentReceipts.data || [], analyticsData)
    }

    // Daily grouping
    const days = eachDayOfInterval({ start: startForChart, end: endForChart })
    days.forEach(d => {
      const key = format(d, 'yyyy-MM-dd')
      usersByKey.set(key, 0)
      receiptsByKey.set(key, 0)
      pointsByKey.set(key, 0)
    })
    analyticsUsers.data?.forEach((u: any) => {
      if (u.created_at) {
        const key = format(new Date(u.created_at), 'yyyy-MM-dd')
        usersByKey.set(key, (usersByKey.get(key) || 0) + 1)
      }
    })
    analyticsReceipts.data?.forEach((r: any) => {
      if (r.created_at) {
        const key = format(new Date(r.created_at), 'yyyy-MM-dd')
        receiptsByKey.set(key, (receiptsByKey.get(key) || 0) + 1)
      }
    })
    analyticsApprovedReceipts.data?.forEach((r: any) => {
      if (r.created_at) {
        const key = format(new Date(r.created_at), 'yyyy-MM-dd')
        const pts = Math.floor((r.total_amount || 0) / bahtPerPoint)
        pointsByKey.set(key, (pointsByKey.get(key) || 0) + pts)
      }
    })

    const analyticsData = days.map(d => ({
      date: format(d, 'dd/MM'),
      users: usersByKey.get(format(d, 'yyyy-MM-dd')) || 0,
      receipts: receiptsByKey.get(format(d, 'yyyy-MM-dd')) || 0,
      points: pointsByKey.get(format(d, 'yyyy-MM-dd')) || 0,
    }))

    return buildResponse({ totalUsers, contractorCount, homeownerCount, newUsersInRange, totalReceipts, pendingReceipts, approvedCount, rejectedReceipts, totalValue, activeRewards: activeRewardsCount.count || 0, pendingRedemptions: pendingRedemptionsCount.count || 0, pointSettings: pointSettings.data || [] }, recentReceipts.data || [], analyticsData)

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
