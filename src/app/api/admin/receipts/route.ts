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

    // Store original search term for full name matching later
    const originalSearch = search?.trim();
    const hasFullNameSearch = originalSearch && originalSearch.includes(' ');

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

    // For search queries, we need to fetch more data and filter server-side
    // because Supabase doesn't support OR queries on related tables well
    if (originalSearch) {
      // Fetch up to 1000 results for filtering
      query = query.range(0, 999);
    } else {
      // No search - normal pagination
      query = query.range(offset, offset + limit - 1);
    }

    // Retry mechanism for database query
    let receipts = null;
    let totalCount = 0;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error, count } = await query;
        if (error) throw error;
        
        receipts = data;
        totalCount = count || 0;
        lastError = null;
        break; // Success, exit loop
      } catch (err) {
        console.warn(`Attempt ${attempt + 1} failed:`, err);
        lastError = err;
        // Wait briefly before retrying (exponential backoff: 500ms, 1000ms)
        if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }

    if (lastError) {
      console.error("Error fetching receipts after 3 attempts:", lastError);
      return NextResponse.json({ error: (lastError as any).message || "Database connection failed" }, { status: 500 });
    }

    // Server-side filtering for search queries
    let filteredReceipts = receipts || [];
    let finalCount = totalCount || 0;

    if (originalSearch) {
      const searchLower = originalSearch.toLowerCase();
      const searchNum = parseFloat(originalSearch);
      const isNumericSearch = !isNaN(searchNum);

      // Filter receipts based on search term
      filteredReceipts = (receipts || []).filter(receipt => {
        const user = receipt.user_profiles;

        // Search in user fields
        if (user) {
          const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
          const reverseName = `${user.last_name || ''} ${user.first_name || ''}`.trim().toLowerCase();
          const displayName = (user.display_name || '').toLowerCase();
          const firstName = (user.first_name || '').toLowerCase();
          const lastName = (user.last_name || '').toLowerCase();

          if (fullName.includes(searchLower) ||
              reverseName.includes(searchLower) ||
              displayName.includes(searchLower) ||
              firstName.includes(searchLower) ||
              lastName.includes(searchLower)) {
            return true;
          }
        }

        // Search in total_amount if search term is numeric
        if (isNumericSearch && receipt.total_amount === searchNum) {
          return true;
        }

        return false;
      });

      // Update count and apply pagination to filtered results
      finalCount = filteredReceipts.length;
      const from = (page - 1) * limit;
      const to = from + limit;
      filteredReceipts = filteredReceipts.slice(from, to);
    }

    return NextResponse.json({
      receipts: filteredReceipts,
      pagination: {
        page,
        limit,
        total: finalCount,
        totalPages: Math.ceil(finalCount / limit)
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