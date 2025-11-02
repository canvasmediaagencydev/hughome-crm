import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { startOfMonth, endOfMonth } from "date-fns";
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

    // Optimize by fetching all user profiles once and counting in-memory
    const [
      allUsers,
      allReceipts,
      activeRewardsCount,
      pendingRedemptionsCount,
      pointSettings
    ] = await Promise.all([
      // Get all users with role (single query instead of 4)
      supabase
        .from("user_profiles")
        .select("role, created_at"),

      // Get all receipts with status and amount (single query instead of 3)
      supabase
        .from("receipts")
        .select("status, total_amount, created_at"),

      // Active rewards count
      supabase
        .from("rewards")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),

      // Pending redemptions count
      supabase
        .from("redemptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "requested"),

      // Point settings (include in dashboard to avoid separate API call)
      supabase
        .from("point_settings")
        .select("*")
        .order("created_at", { ascending: false })
    ]);

    // Check for errors
    if (allUsers.error) throw allUsers.error;
    if (allReceipts.error) throw allReceipts.error;
    if (activeRewardsCount.error) throw activeRewardsCount.error;
    if (pendingRedemptionsCount.error) throw pendingRedemptionsCount.error;
    if (pointSettings.error) throw pointSettings.error;

    // Calculate metrics in-memory (more efficient than multiple queries)
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

    // Return consolidated metrics (including point settings)
    return NextResponse.json({
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
      totalPointsEarned: 0, // TODO: Calculate from point_transactions if needed
      totalPointsSpent: 0, // TODO: Calculate from point_transactions if needed
      averageProcessingTime: 0, // TODO: Calculate if needed
      pointSettings: pointSettings.data || []
    });

  } catch (error: any) {
    console.error("Dashboard metrics error:", error);

    if (typeof error?.message === 'string') {
      if (error.message.startsWith('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      if (error.message.includes('Forbidden')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}
