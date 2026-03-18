import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { subDays, startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function GET(request: Request) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW)

    const { searchParams } = new URL(request.url)
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 7), 90)
    const role = searchParams.get('role') || 'all'

    const supabase = createServerSupabaseClient();

    const now = new Date();
    const endRange = now;
    const startRange = subDays(endRange, days - 1);
    const dateInterval = eachDayOfInterval({ start: startRange, end: endRange });
    const startRangeISO = startOfDay(startRange).toISOString();
    const endRangeISO = endOfDay(endRange).toISOString();

    // If role filter, fetch matching user IDs first (fast query)
    let roleUserIds: string[] | null = null
    if (role !== 'all') {
      const { data: roleUsers } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', role)
      roleUserIds = roleUsers?.map((u: { id: string }) => u.id) || []
    }

    // Build receipt query helper
    const applyRoleFilter = (query: any) =>
      roleUserIds ? query.in('user_id', roleUserIds) : query

    // Fetch all data in parallel
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
      // All users (with role filter)
      (() => {
        let q = supabase.from("user_profiles").select("role, created_at")
        if (role !== 'all') q = q.eq('role', role)
        return q
      })(),

      // All receipts (with role filter)
      applyRoleFilter(
        supabase.from("receipts").select("status, total_amount, created_at")
      ),

      // Active rewards (no role filter)
      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("is_active", true),

      // Pending redemptions (no role filter)
      supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("status", "requested"),

      // Point settings
      supabase.from("point_settings").select("*").order("created_at", { ascending: false }),

      // Recent receipts (with role filter)
      applyRoleFilter(
        supabase
          .from("receipts")
          .select(`*, user_profiles!receipts_user_id_fkey (id, display_name, first_name, last_name)`)
          .order("created_at", { ascending: false })
          .limit(10)
      ),

      // Analytics: new users in date range (with role filter)
      (() => {
        let q = supabase.from('user_profiles').select('created_at').gte('created_at', startRangeISO).lte('created_at', endRangeISO)
        if (role !== 'all') q = q.eq('role', role)
        return q
      })(),

      // Analytics: all receipts in date range (with role filter)
      applyRoleFilter(
        supabase.from('receipts').select('created_at').gte('created_at', startRangeISO).lte('created_at', endRangeISO)
      ),

      // Analytics: approved receipts in date range (with role filter)
      applyRoleFilter(
        supabase.from('receipts').select('created_at, total_amount').eq('status', 'approved').gte('created_at', startRangeISO).lte('created_at', endRangeISO)
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

    const usersByDate = new Map<string, number>();
    const receiptsByDate = new Map<string, number>();
    const pointsByDate = new Map<string, number>();

    dateInterval.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      usersByDate.set(key, 0);
      receiptsByDate.set(key, 0);
      pointsByDate.set(key, 0);
    });

    analyticsUsers.data?.forEach((user: any) => {
      if (user.created_at) {
        const dateKey = format(new Date(user.created_at), 'yyyy-MM-dd');
        usersByDate.set(dateKey, (usersByDate.get(dateKey) || 0) + 1);
      }
    });

    analyticsReceipts.data?.forEach((receipt: any) => {
      if (receipt.created_at) {
        const dateKey = format(new Date(receipt.created_at), 'yyyy-MM-dd');
        receiptsByDate.set(dateKey, (receiptsByDate.get(dateKey) || 0) + 1);
      }
    });

    analyticsApprovedReceipts.data?.forEach((receipt: any) => {
      if (receipt.created_at) {
        const dateKey = format(new Date(receipt.created_at), 'yyyy-MM-dd');
        const points = Math.floor((receipt.total_amount || 0) / bahtPerPoint);
        pointsByDate.set(dateKey, (pointsByDate.get(dateKey) || 0) + points);
      }
    });

    const analyticsData = dateInterval.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        date: format(date, 'dd/MM'),
        users: usersByDate.get(dateKey) || 0,
        receipts: receiptsByDate.get(dateKey) || 0,
        points: pointsByDate.get(dateKey) || 0
      };
    });

    return NextResponse.json(
      {
        metrics: {
          totalUsers,
          contractorCount,
          homeownerCount,
          monthlyActiveUsers: newUsersInRange,
          totalReceipts,
          pendingReceipts,
          approvedReceipts: approvedCount,
          rejectedReceipts,
          totalReceiptValue: totalValue,
          activeRewards: activeRewardsCount.count || 0,
          pendingRedemptions: pendingRedemptionsCount.count || 0,
          totalPointsEarned: 0,
          totalPointsSpent: 0,
          averageProcessingTime: 0,
          pointSettings: pointSettings.data || []
        },
        recentReceipts: recentReceipts.data || [],
        analytics: analyticsData
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, private',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error: any) {
    console.error("Consolidated dashboard API error:", error);

    if (typeof error?.message === 'string') {
      if (error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
