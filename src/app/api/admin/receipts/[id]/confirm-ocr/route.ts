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
    await requirePermission(PERMISSIONS.RECEIPTS_APPROVE);

    const supabase = createServerSupabaseClient();
    const { id } = await params;
    const body = await request.json();
    const { ocr_data, ocr_processed_at } = body;

    if (!ocr_data) {
      return NextResponse.json(
        { error: "OCR data is required" },
        { status: 400 }
      );
    }

    // Verify receipt is still in pending status
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select("id, status")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found or not in pending status" },
        { status: 404 }
      );
    }

    // Update receipt with confirmed OCR data
    const currentTime = ocr_processed_at || new Date().toISOString();
    const { error: updateError } = await supabase
      .from("receipts")
      .update({
        ocr_data: ocr_data,
        total_amount: ocr_data.ยอดรวม || 0,
        ocr_processed_at: currentTime,
        updated_at: currentTime
      })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating receipt:", updateError);
      return NextResponse.json(
        { error: "Failed to update receipt with OCR data" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OCR data confirmed and saved successfully",
      ocr_data: ocr_data,
      ocr_processed_at: currentTime
    });

  } catch (error) {
    console.error("Confirm OCR error:", error);
    return NextResponse.json(
      {
        error: "Failed to confirm OCR data",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
