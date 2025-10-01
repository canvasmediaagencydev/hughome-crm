import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { Database } from "../../../../../database.types";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    let userIds: string[] | undefined;

    // If search query exists, find matching user IDs first
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      const { data: users } = await supabase
        .from("user_profiles")
        .select("id")
        .or(`display_name.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},phone.ilike.${searchTerm}`);

      if (users && users.length > 0) {
        userIds = users.map(u => u.id);
      } else {
        // No users found, return empty results
        return NextResponse.json({
          redemptions: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }
    }

    let query = supabase
      .from("redemptions")
      .select(`
        *,
        rewards (
          id,
          name,
          description,
          image_url,
          points_cost
        ),
        user_profiles!redemptions_user_id_fkey (
          id,
          display_name,
          first_name,
          last_name,
          phone
        )
      `, { count: 'exact' })
      .order("created_at", { ascending: false });

    // Filter by user IDs if search was performed
    if (userIds) {
      query = query.in("user_id", userIds);
    }

    // Filter by status if provided
    if (status && status !== "all") {
      query = query.eq("status", status as Database["public"]["Enums"]["redemption_status"]);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: redemptions, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      redemptions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch redemptions" },
      { status: 500 }
    );
  }
}
