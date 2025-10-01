import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Fetch user's redemptions with reward details
    const { data: redemptions, error } = await supabase
      .from("redemptions")
      .select(`
        *,
        rewards (
          id,
          name,
          description,
          image_url,
          points_cost
        )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(redemptions);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch redemptions" },
      { status: 500 }
    );
  }
}
