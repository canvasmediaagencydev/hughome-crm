import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { parseISO, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_VIEW);

    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("start"); // "2025-01-01"
    const endDate = searchParams.get("end"); // "2025-01-31"

    // Validate parameters
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: start and end (format: YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    let start: Date;
    let end: Date;
    try {
      start = startOfDay(parseISO(startDate));
      end = endOfDay(parseISO(endDate));
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Invalid date");
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("created_at, first_name, last_name, phone, points_balance")
      .not("role", "is", null)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      start_date: startDate,
      end_date: endDate,
      total_count: users?.length || 0,
      generated_at: new Date().toISOString(),
      users: users || [],
    });
  } catch (error: unknown) {
    console.error("Report API error:", error);

    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Unauthorized")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
