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

    const { data: allReceipts, error, count: totalCount } = await query;

    if (error) {
      console.error("Error fetching receipts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by search on server side
    let filteredReceipts = allReceipts || [];
    if (search && filteredReceipts.length > 0) {
      const searchLower = search.toLowerCase();
      const searchNum = parseFloat(search);

      filteredReceipts = filteredReceipts.filter((receipt: any) => {
        const user = receipt.user_profiles;
        const displayName = (user?.display_name || '').toLowerCase();
        const firstName = (user?.first_name || '').toLowerCase();
        const lastName = (user?.last_name || '').toLowerCase();
        const totalAmount = receipt.total_amount || 0;

        return displayName.includes(searchLower) ||
               firstName.includes(searchLower) ||
               lastName.includes(searchLower) ||
               (!isNaN(searchNum) && totalAmount === searchNum);
      });
    }

    // Apply pagination to filtered results
    const receipts = filteredReceipts.slice(offset, offset + limit);

    return NextResponse.json({
      receipts,
      pagination: {
        page,
        limit,
        total: filteredReceipts.length,
        totalPages: Math.ceil(filteredReceipts.length / limit)
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