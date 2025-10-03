import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const { data: receipts, error } = await supabase
      .from("receipts")
      .select(`
        *,
        user_profiles!receipts_user_id_fkey (
          id,
          display_name,
          first_name,
          last_name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent receipts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      receipts: receipts || [],
      total: receipts?.length || 0
    });

  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent receipts" },
      { status: 500 }
    );
  }
}