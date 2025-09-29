import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const body = await request.json();
    const { admin_notes } = body;

    if (!admin_notes || admin_notes.trim() === "") {
      return NextResponse.json(
        { error: "Admin notes are required for rejection" },
        { status: 400 }
      );
    }

    // Check if receipt exists and is pending
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("id, status, user_id")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found or already processed" },
        { status: 404 }
      );
    }

    const currentTime = new Date().toISOString();

    // Update receipt status to rejected
    const { error: updateError } = await supabase
      .from("receipts")
      .update({
        status: "rejected",
        admin_notes,
        approved_at: currentTime,
        approved_by: null, // TODO: In a real app, this would be the admin's user ID
        updated_at: currentTime,
        points_awarded: 0 // No points for rejected receipts
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating receipt:", updateError);
      return NextResponse.json(
        { error: "Failed to reject receipt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Receipt rejected successfully",
      receipt: {
        id,
        status: "rejected",
        admin_notes,
        rejected_at: currentTime
      }
    });

  } catch (error) {
    console.error("Reject receipt error:", error);
    return NextResponse.json(
      { error: "Failed to reject receipt" },
      { status: 500 }
    );
  }
}