import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { format, subDays, startOfDay, endOfDay, parseISO, eachDayOfInterval } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const bahtPerPointParam = searchParams.get("baht_per_point");

    // Determine date range
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

    // Use baht_per_point from query param if provided (to avoid duplicate DB query)
    let bahtPerPoint = 100; // default
    if (bahtPerPointParam) {
      bahtPerPoint = parseFloat(bahtPerPointParam);
    }

    // Fetch ALL data in single queries (instead of looping per day)
    // Only fetch point_settings if not provided via param
    const shouldFetchSettings = !bahtPerPointParam;

    const queries: Promise<any>[] = [
      // All users in date range
      supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startRangeISO)
        .lte('created_at', endRangeISO),

      // All receipts in date range
      supabase
        .from('receipts')
        .select('created_at')
        .gte('created_at', startRangeISO)
        .lte('created_at', endRangeISO),

      // All approved receipts with amounts
      supabase
        .from('receipts')
        .select('created_at, total_amount')
        .eq('status', 'approved')
        .gte('created_at', startRangeISO)
        .lte('created_at', endRangeISO)
    ];

    // Only query point_settings if not provided
    if (shouldFetchSettings) {
      queries.push(
        supabase
          .from('point_settings')
          .select('setting_value')
          .eq('setting_key', 'baht_per_point')
          .eq('is_active', true)
          .single()
      );
    }

    const results = await Promise.all(queries);
    const usersResult = results[0];
    const receiptsResult = results[1];
    const approvedReceiptsResult = results[2];
    const settingsResult = shouldFetchSettings ? results[3] : null;

    if (settingsResult?.data?.setting_value) {
      bahtPerPoint = settingsResult.data.setting_value;
    }

    // Group data by date in JavaScript (more efficient than N queries)
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
    usersResult.data?.forEach(user => {
      const dateKey = format(new Date(user.created_at), 'yyyy-MM-dd');
      usersByDate.set(dateKey, (usersByDate.get(dateKey) || 0) + 1);
    });

    // Count receipts per date
    receiptsResult.data?.forEach(receipt => {
      const dateKey = format(new Date(receipt.created_at), 'yyyy-MM-dd');
      receiptsByDate.set(dateKey, (receiptsByDate.get(dateKey) || 0) + 1);
    });

    // Calculate points per date
    approvedReceiptsResult.data?.forEach(receipt => {
      const dateKey = format(new Date(receipt.created_at), 'yyyy-MM-dd');
      const points = Math.floor((receipt.total_amount || 0) / bahtPerPoint);
      pointsByDate.set(dateKey, (pointsByDate.get(dateKey) || 0) + points);
    });

    // Build final analytics array
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

    return NextResponse.json({
      data: analyticsData,
      summary: {
        totalUsers: analyticsData.reduce((sum, item) => sum + item.users, 0),
        totalReceipts: analyticsData.reduce((sum, item) => sum + item.receipts, 0),
        totalPoints: analyticsData.reduce((sum, item) => sum + item.points, 0),
        days: dateInterval.length
      }
    });

  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}