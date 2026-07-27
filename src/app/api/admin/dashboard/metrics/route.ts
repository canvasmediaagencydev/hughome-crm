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

    // New model: "receipts" no longer exist. Map the old metric shape onto the
    // real tables — committed batches, not-yet-delivered redemptions, and total
    // points handed out. All zero until real data exists (correct).
    const [
      allUsers,
      committedBatches,
      voidedBatches,
      pendingPickups,
      ledger,
      activeRewardsCount,
      pendingRedemptionsCount,
      pointSettings
    ] = await Promise.all([
      supabase.from("user_profiles").select("role, created_at"),
      // จำนวนใบเสร็จ → จำนวน batch ที่ commit
      supabase.from("point_batches").select("*", { count: "exact", head: true }).eq("status", "committed"),
      supabase.from("point_batches").select("*", { count: "exact", head: true }).eq("status", "voided"),
      // รออนุมัติ → คำขอแลกที่ยังไม่ delivered
      supabase.from("redemptions").select("*", { count: "exact", head: true }).not("status", "in", "(delivered,cancelled)"),
      // ยอดรวม → แต้มที่แจกไปทั้งหมด
      supabase.from("point_batch_ledger").select("points_earned"),
      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("redemptions").select("*", { count: "exact", head: true }).eq("status", "requested"),
      supabase.from("point_settings").select("*").order("created_at", { ascending: false })
    ]);

    // Check for errors
    if (allUsers.error) throw allUsers.error;
    if (committedBatches.error) throw committedBatches.error;
    if (voidedBatches.error) throw voidedBatches.error;
    if (pendingPickups.error) throw pendingPickups.error;
    if (ledger.error) throw ledger.error;
    if (activeRewardsCount.error) throw activeRewardsCount.error;
    if (pendingRedemptionsCount.error) throw pendingRedemptionsCount.error;
    if (pointSettings.error) throw pointSettings.error;

    // Calculate metrics in-memory (more efficient than multiple queries)
    const users = allUsers.data || [];

    const totalUsers = users.length;
    const contractorCount = users.filter(u => u.role === "contractor").length;
    const homeownerCount = users.filter(u => u.role === "homeowner").length;
    const monthlyActiveUsers = users.filter(u => {
      const createdAt = new Date(u.created_at);
      return createdAt >= currentMonthStart && createdAt <= currentMonthEnd;
    }).length;

    const totalReceipts = committedBatches.count || 0;      // committed batches
    const pendingReceipts = pendingPickups.count || 0;      // redemptions not delivered
    const approvedCount = committedBatches.count || 0;
    const rejectedReceipts = voidedBatches.count || 0;      // voided batches
    const totalValue = (ledger.data || []).reduce((sum, r) => sum + (r.points_earned || 0), 0);

    // Return consolidated metrics (including point settings)
    return NextResponse.json(
      {
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
