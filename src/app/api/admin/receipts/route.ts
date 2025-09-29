import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    let query = supabase
      .from("receipts")
      .select(`
        *,
        user_profiles!receipts_user_id_fkey (
          id,
          display_name,
          first_name,
          last_name,
          line_user_id
        ),
        receipt_images (
          id,
          file_name,
          file_path,
          file_size,
          mime_type
        )
      `)
      .eq("status", status as any)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Add search filter if provided
    if (search) {
      query = query.or(`
        user_profiles.display_name.ilike.%${search}%,
        user_profiles.first_name.ilike.%${search}%,
        user_profiles.last_name.ilike.%${search}%,
        total_amount.eq.${parseFloat(search) || 0}
      `);
    }

    const { data: receipts, error } = await query;

    if (error) {
      console.error("Error fetching receipts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from("receipts")
      .select("id", { count: "exact", head: true })
      .eq("status", status as any);

    if (search) {
      countQuery = countQuery.or(`
        user_profiles.display_name.ilike.%${search}%,
        user_profiles.first_name.ilike.%${search}%,
        user_profiles.last_name.ilike.%${search}%,
        total_amount.eq.${parseFloat(search) || 0}
      `);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Error getting count:", countError);
    }

    return NextResponse.json({
      receipts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch receipts" },
      { status: 500 }
    );
  }
}