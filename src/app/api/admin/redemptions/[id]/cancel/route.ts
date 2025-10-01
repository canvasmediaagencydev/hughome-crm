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

    // Get user's current balance
    const { data: user, error: userError } = await supabase
      .from("user_profiles")
      .select("points_balance")
      .eq("id", redemption.user_id)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Calculate new balance (refund points back to user)
    const newBalance = user.points_balance + redemption.points_used;

    // Update user points balance
    const { error: updateUserError } = await supabase
      .from("user_profiles")
      .update({ points_balance: newBalance })
      .eq("id", redemption.user_id);

    if (updateUserError) {
      console.error("Failed to update user balance:", updateUserError);
      return NextResponse.json(
        { error: "Failed to refund points" },
        { status: 500 }
      );
    }

    // Create refund transaction record (for logging only)
    const { error: transactionError } = await supabase
      .from("point_transactions")
      .insert({
        user_id: redemption.user_id,
        type: "refund",
        points: redemption.points_used,
        balance_after: newBalance,
        reference_type: "redemption",
        reference_id: redemption.id,
        description: `คืนแต้มจากการยกเลิกการแลกรางวัล ${adminNotes ? `(${adminNotes})` : ''}`,
        created_by: adminId,
      });

    if (transactionError) {
      console.error("Failed to create transaction record:", transactionError);
      // Don't fail the operation if transaction log fails
    }

    // Update redemption status to cancelled
    const { data: updatedRedemption, error: updateError } = await supabase
      .from("redemptions")
      .update({
        status: "cancelled",
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
      refundedPoints: redemption.points_used,
      newBalance,
    });
  } catch (error) {
    console.error("Cancel redemption error:", error);
    return NextResponse.json(
      { error: "Failed to cancel redemption" },
      { status: 500 }
    );
  }
}
