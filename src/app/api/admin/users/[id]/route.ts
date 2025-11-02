import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ต้องมี users.view permission
    await requirePermission(PERMISSIONS.USERS_VIEW);

    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Get pagination params
    const { searchParams } = new URL(request.url);
    const transactionPage = parseInt(searchParams.get("transactionPage") || "1");
    const transactionLimit = parseInt(searchParams.get("transactionLimit") || "5");
    const redemptionPage = parseInt(searchParams.get("redemptionPage") || "1");
    const redemptionLimit = parseInt(searchParams.get("redemptionLimit") || "5");

    // Get user profile
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get transactions with pagination
    const transactionFrom = (transactionPage - 1) * transactionLimit;
    const transactionTo = transactionFrom + transactionLimit - 1;

    const { data: transactions, count: transactionCount } = await supabase
      .from("point_transactions")
      .select("*", { count: "exact" })
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .range(transactionFrom, transactionTo);

    // Get redemptions with pagination
    const redemptionFrom = (redemptionPage - 1) * redemptionLimit;
    const redemptionTo = redemptionFrom + redemptionLimit - 1;

    const { data: redemptions, count: redemptionCount } = await supabase
      .from("redemptions")
      .select(`
        id,
        points_used,
        status,
        shipping_address,
        tracking_number,
        created_at,
        rewards (
          name,
          image_url
        )
      `, { count: "exact" })
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .range(redemptionFrom, redemptionTo);

    return NextResponse.json({
      user,
      transactions: transactions || [],
      transactionPagination: {
        page: transactionPage,
        limit: transactionLimit,
        total: transactionCount || 0,
        totalPages: Math.ceil((transactionCount || 0) / transactionLimit),
      },
      redemptions: redemptions || [],
      redemptionPagination: {
        page: redemptionPage,
        limit: redemptionLimit,
        total: redemptionCount || 0,
        totalPages: Math.ceil((redemptionCount || 0) / redemptionLimit),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch user details" },
      { status: 500 }
    );
  }
}
