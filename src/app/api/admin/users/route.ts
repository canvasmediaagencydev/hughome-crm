import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { parseISO, subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const days = searchParams.get("days");

    let query = supabase
      .from("user_profiles")
      .select("*", { count: "exact" })
      .order("points_balance", { ascending: false, nullsFirst: false });

    // Date filtering (only if explicitly provided)
    if (startDate && endDate) {
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (days) {
      const cutoffDate = subDays(new Date(), parseInt(days));
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    // Search by name or phone
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(
        `first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`
      );
    }

    // Filter by role
    if (role && role !== "all") {
      query = query.eq("role", role);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: users, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
