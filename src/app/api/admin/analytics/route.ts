import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { format, subDays, startOfDay, endOfDay, parseISO, eachDayOfInterval } from "date-fns";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

// New model: no receipts. The daily time-series now sources from real tables:
//   "receipts" series → committed batches per day (point_batches)
//   "points"   series → points handed out per day (point_batch_ledger.points_earned)
// Values are 0 until real data exists (correct).
export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW);

    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    let startRange: Date;
    let endRange: Date;
    if (startDate && endDate) {
      startRange = parseISO(startDate);
      endRange = parseISO(endDate);
    } else {
      endRange = new Date();
      startRange = subDays(endRange, days - 1);
    }

    const dateInterval = eachDayOfInterval({ start: startRange, end: endRange });
    const startRangeISO = startOfDay(startRange).toISOString();
    const endRangeISO = endOfDay(endRange).toISOString();

    const [usersResult, batchesResult, ledgerResult] = await Promise.all([
      supabase.from('user_profiles').select('created_at')
        .gte('created_at', startRangeISO).lte('created_at', endRangeISO),
      // committed batches in range → "receipts" series
      supabase.from('point_batches').select('committed_at')
        .eq('status', 'committed')
        .gte('committed_at', startRangeISO).lte('committed_at', endRangeISO),
      // points handed out in range → "points" series
      supabase.from('point_batch_ledger').select('created_at, points_earned')
        .gte('created_at', startRangeISO).lte('created_at', endRangeISO),
    ]);

    const usersByDate = new Map<string, number>();
    const batchesByDate = new Map<string, number>();
    const pointsByDate = new Map<string, number>();

    dateInterval.forEach(date => {
      const key = format(date, 'yyyy-MM-dd');
      usersByDate.set(key, 0);
      batchesByDate.set(key, 0);
      pointsByDate.set(key, 0);
    });

    usersResult.data?.forEach((u: any) => {
      if (u.created_at) {
        const k = format(new Date(u.created_at), 'yyyy-MM-dd');
        usersByDate.set(k, (usersByDate.get(k) || 0) + 1);
      }
    });
    batchesResult.data?.forEach((b: any) => {
      if (b.committed_at) {
        const k = format(new Date(b.committed_at), 'yyyy-MM-dd');
        batchesByDate.set(k, (batchesByDate.get(k) || 0) + 1);
      }
    });
    ledgerResult.data?.forEach((l: any) => {
      if (l.created_at) {
        const k = format(new Date(l.created_at), 'yyyy-MM-dd');
        pointsByDate.set(k, (pointsByDate.get(k) || 0) + (l.points_earned || 0));
      }
    });

    const analyticsData = dateInterval.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      return {
        date: format(date, 'dd/MM'),
        users: usersByDate.get(dateKey) || 0,
        receipts: batchesByDate.get(dateKey) || 0, // committed batches
        points: pointsByDate.get(dateKey) || 0,
      };
    });

    return NextResponse.json({
      data: analyticsData,
      summary: {
        totalUsers: analyticsData.reduce((sum, item) => sum + item.users, 0),
        totalReceipts: analyticsData.reduce((sum, item) => sum + item.receipts, 0),
        totalPoints: analyticsData.reduce((sum, item) => sum + item.points, 0),
        days: dateInterval.length,
      },
    });

  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
