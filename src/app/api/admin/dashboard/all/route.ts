import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW)

    const supabase = createServerSupabaseClient();

    // Get current month boundaries
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Analytics date range (last 7 days)
    const endRange = new Date();
    const startRange = subDays(endRange, 6); // 7 days total
    const dateInterval = eachDayOfInterval({ start: startRange, end: endRange });
    const startRangeISO = startOfDay(startRange).toISOString();
    const endRangeISO = endOfDay(endRange).toISOString();

    // Fetch ALL data in parallel (single consolidated query set)
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
      // Dashboard: All users
      supabase
        .from("user_profiles")
        .select("role, created_at"),

      // Dashboard: All receipts
      supabase
        .from("receipts")
        .select("status, total_amount, created_at"),

      // Dashboard: Active rewards
      supabase
        .from("rewards")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),

      // Dashboard: Pending redemptions
      supabase
        .from("redemptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "requested"),

      // Dashboard: Point settings
      supabase
        .from("point_settings")
        .select("*")
        .order("created_at", { ascending: false }),

      // Recent receipts
      supabase
        .from("receipts")
        .select(`
          *,
          user_profiles!receipts_user_id_fkey (
            id,
            display_name,
            first_name,
            last_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10),

      // Analytics: Users in date range
      supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startRangeISO)
        .lte('created_at', endRangeISO),

      // Analytics: All receipts in date range
      supabase
        .from('receipts')
        .select('created_at')
        .gte('created_at', startRangeISO)
        .lte('created_at', endRangeISO),

      // Analytics: Approved receipts with amounts
      supabase
        .from('receipts')
        .select('created_at, total_amount')
        .eq('status', 'approved')
        .gte('created_at', startRangeISO)
        .lte('created_at', endRangeISO)
    ]);

    // Check for errors
    if (allUsers.error) throw allUsers.error;
    if (allReceipts.error) throw allReceipts.error;
    if (activeRewardsCount.error) throw activeRewardsCount.error;
    if (pendingRedemptionsCount.error) throw pendingRedemptionsCount.error;
    if (pointSettings.error) throw pointSettings.error;
    if (recentReceipts.error) throw recentReceipts.error;
    if (analyticsUsers.error) throw analyticsUsers.error;
    if (analyticsReceipts.error) throw analyticsReceipts.error;
    if (analyticsApprovedReceipts.error) throw analyticsApprovedReceipts.error;

    // === DASHBOARD METRICS ===
    const users = allUsers.data || [];
    const receipts = allReceipts.data || [];

    const totalUsers = users.length;
    const contractorCount = users.filter(u => u.role === "contractor").length;
    const homeownerCount = users.filter(u => u.role === "homeowner").length;
    const monthlyActiveUsers = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= currentMonthStart && createdAt <= currentMonthEnd;
    }).length;

    const totalReceipts = receipts.length;
    const pendingReceipts = receipts.filter(r => r.status === "pending").length;
    const approvedReceipts = receipts.filter(r => r.status === "approved");
    const approvedCount = approvedReceipts.length;
    const rejectedReceipts = receipts.filter(r => r.status === "rejected").length;
    const totalValue = approvedReceipts.reduce((sum, r) => sum + (r.total_amount || 0), 0);

    // === ANALYTICS DATA ===
    const bahtPerPoint = pointSettings.data?.find(s => s.setting_key === 'baht_per_point')?.setting_value || 100;

    const usersByDate = new Map<string, number>();
    const receiptsByDate = new Map<string, number>();
    const pointsByDate = new Map<string, number>();

    // Initialize all dates with 0
    dateInterval.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      usersByDate.set(key, 0);
      receiptsByDate.set(key, 0);
      pointsByDate.set(key, 0);
    });

    // Count users per date
    analyticsUsers.data?.forEach(user => {
      if (user.created_at) {
        const dateKey = format(new Date(user.created_at), 'yyyy-MM-dd');
        usersByDate.set(dateKey, (usersByDate.get(dateKey) || 0) + 1);
      }
    });

    // Count receipts per date
    analyticsReceipts.data?.forEach(receipt => {
      if (receipt.created_at) {
        const dateKey = format(new Date(receipt.created_at), 'yyyy-MM-dd');
        receiptsByDate.set(dateKey, (receiptsByDate.get(dateKey) || 0) + 1);
      }
    });

    // Calculate points per date
    analyticsApprovedReceipts.data?.forEach(receipt => {
      if (receipt.created_at) {
        const dateKey = format(new Date(receipt.created_at), 'yyyy-MM-dd');
        const points = Math.floor((receipt.total_amount || 0) / bahtPerPoint);
        pointsByDate.set(dateKey, (pointsByDate.get(dateKey) || 0) + points);
      }
    });

    // Build analytics array
    const analyticsData = dateInterval.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const displayDate = format(date, 'dd/MM');

      return {
        date: displayDate,
        users: usersByDate.get(dateKey) || 0,
        receipts: receiptsByDate.get(dateKey) || 0,
        points: pointsByDate.get(dateKey) || 0
      };
    });

    // Return consolidated response
    return NextResponse.json({
      metrics: {
        totalUsers,
        contractorCount,
        homeownerCount,
        monthlyActiveUsers,
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
    });

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

    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
