import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const body = await request.json();
    const { adminId, adminNotes } = body;

    // Get redemption details
    const { data: redemption, error: redemptionError } = await supabase
      .from("redemptions")
      .select("*")
      .eq("id", id)
      .single();

    if (redemptionError || !redemption) {
      return NextResponse.json(
        { error: "Redemption not found" },
        { status: 404 }
      );
    }

    // Check if already processed
    if (redemption.status === "shipped" || redemption.status === "cancelled") {
      return NextResponse.json(
        { error: "Redemption already processed" },
        { status: 400 }
      );
    }

    // Update redemption status to "shipped" (completed/picked up)
    const { data: updatedRedemption, error: updateError } = await supabase
      .from("redemptions")
      .update({
        status: "shipped",
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redemption: updatedRedemption,
    });
  } catch (error) {
    console.error("Complete redemption error:", error);
    return NextResponse.json(
      { error: "Failed to complete redemption" },
      { status: 500 }
    );
  }
}
