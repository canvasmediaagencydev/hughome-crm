import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { parseISO, subDays, startOfDay, endOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    // ต้องมี receipts.view permission
    await requirePermission(PERMISSIONS.RECEIPTS_VIEW);

    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") || "pending";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const days = searchParams.get("days");

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
      `, { count: 'exact' })
      .eq("status", status as any)
      .order("created_at", { ascending: false });

    // Date filtering (only if explicitly provided)
    if (startDate && endDate) {
      const start = startOfDay(parseISO(startDate)).toISOString();
      const end = endOfDay(parseISO(endDate)).toISOString();
      query = query.gte('created_at', start).lte('created_at', end);
    } else if (days) {
      const cutoffDate = subDays(new Date(), parseInt(days));
      query = query.gte('created_at', cutoffDate.toISOString());
    }

    // Search filtering at database level (much faster than JavaScript filtering)
    if (search && search.trim()) {
      const searchTrim = search.trim();
      const searchNum = parseFloat(searchTrim);

      // If search is a number, also search by total_amount
      if (!isNaN(searchNum)) {
        query = query.or(`user_profiles.display_name.ilike.%${searchTrim}%,user_profiles.first_name.ilike.%${searchTrim}%,user_profiles.last_name.ilike.%${searchTrim}%,total_amount.eq.${searchNum}`);
      } else {
        // Text search only in user profile fields
        query = query.or(`user_profiles.display_name.ilike.%${searchTrim}%,user_profiles.first_name.ilike.%${searchTrim}%,user_profiles.last_name.ilike.%${searchTrim}%`);
      }
    }

    // Apply pagination at database level
    query = query.range(offset, offset + limit - 1);

    const { data: receipts, error, count: totalCount } = await query;

    if (error) {
      console.error("Error fetching receipts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      receipts: receipts || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
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