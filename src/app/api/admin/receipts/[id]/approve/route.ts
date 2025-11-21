import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // ต้องมี receipts.approve permission
    const adminUser = await requirePermission(PERMISSIONS.RECEIPTS_APPROVE);

    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const body = await request.json();
    const { points_awarded, admin_notes } = body;

    if (points_awarded === undefined || points_awarded === null || points_awarded < 0) {
      return NextResponse.json(
        { error: "Valid points_awarded is required (must be >= 0)" },
        { status: 400 }
      );
    }

    // Start a transaction by getting the receipt first
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select(`
        *,
        user_profiles!receipts_user_id_fkey (
          id,
          points_balance
        )
      `)
      .eq("id", id)
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Check if receipt is already processed
    if (receipt.status !== "pending") {
      if (receipt.status === "approved") {
        return NextResponse.json({
          success: true,
          message: "Receipt is already approved",
          receipt: {
            id,
            status: "approved",
            points_awarded: receipt.points_awarded,
            approved_at: receipt.approved_at
          },
          user_points: {
             // We don't have the new balance here easily without refetching, 
             // but for idempotency this is acceptable
             new_balance: receipt.user_profiles?.points_balance,
             points_earned: 0
          }
        });
      }

      return NextResponse.json(
        { error: `Receipt is already ${receipt.status}` },
        { status: 409 } // Conflict
      );
    }

    const currentTime = new Date().toISOString();
    const user = receipt.user_profiles;

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Calculate new balance
    const newPointsBalance = (user.points_balance || 0) + points_awarded;

    // Update user points balance first
    const { error: updateUserError } = await supabase
      .from("user_profiles")
      .update({ points_balance: newPointsBalance })
      .eq("id", user.id);

    if (updateUserError) {
      console.error("Error updating user balance:", updateUserError);
      return NextResponse.json(
        { error: "Failed to update user balance" },
        { status: 500 }
      );
    }

    // Update receipt status
    const { error: updateReceiptError } = await supabase
      .from("receipts")
      .update({
        status: "approved",
        points_awarded,
        admin_notes,
        approved_at: currentTime,
        approved_by: null, // TODO: In a real app, this would be the admin's user ID
        updated_at: currentTime
      })
      .eq("id", id);

    if (updateReceiptError) {
      console.error("Error updating receipt:", updateReceiptError);
      // Rollback points update
      await supabase
        .from("user_profiles")
        .update({ points_balance: user.points_balance })
        .eq("id", user.id);

      return NextResponse.json(
        { error: "Failed to update receipt" },
        { status: 500 }
      );
    }

    // Create point transaction record (for logging only)
    const { error: transactionError } = await supabase
      .from("point_transactions")
      .insert({
        user_id: user.id,
        type: "earned",
        points: points_awarded,
        balance_after: newPointsBalance,
        description: `Points earned from receipt approval`,
        reference_id: id,
        reference_type: "receipt",
        created_by: null, // TODO: In a real app, this would be the admin's user ID
        created_at: currentTime
      });

    if (transactionError) {
      console.error("Error creating point transaction:", transactionError);
      // Don't fail the whole operation for transaction log failure
    }

    return NextResponse.json({
      success: true,
      message: "Receipt approved successfully",
      receipt: {
        id,
        status: "approved",
        points_awarded,
        approved_at: currentTime
      },
      user_points: {
        new_balance: newPointsBalance,
        points_earned: points_awarded
      }
    });

  } catch (error) {
    console.error("Approve receipt error:", error);
    return NextResponse.json(
      { error: "Failed to approve receipt" },
      { status: 500 }
    );
  }
}