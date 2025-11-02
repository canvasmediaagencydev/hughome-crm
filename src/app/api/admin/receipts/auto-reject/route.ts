import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";

export async function POST(request: NextRequest) {
  try {
    // ต้องมี receipts.auto_process permission
    await requirePermission(PERMISSIONS.RECEIPTS_AUTO_PROCESS);

    const supabase = createServerSupabaseClient();

    // Get all pending receipts with OCR data
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select(`
        *,
        user_profiles!receipts_user_id_fkey (
          id,
          points_balance
        )
      `)
      .eq("status", "pending");

    if (receiptsError) {
      console.error("Error fetching receipts:", receiptsError);
      return NextResponse.json(
        { error: "Failed to fetch receipts" },
        { status: 500 }
      );
    }

    if (!receipts || receipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending receipts found",
        rejected_count: 0
      });
    }

    // Filter receipts that are NOT from "ตั้งหง่วงเซ้ง" store
    const nonStoreReceipts = receipts.filter(receipt => {
      const ocrData = receipt.ocr_data;
      if (!ocrData || typeof ocrData !== 'object') return false;

      const storeField = (ocrData as any).ชื่อร้าน || (ocrData as any)["ชื่อร้าน"];
      return storeField === false; // Only reject if store field is exactly false
    });

    if (nonStoreReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No non-store receipts found to auto-reject",
        rejected_count: 0
      });
    }

    const currentTime = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each non-store receipt
    for (const receipt of nonStoreReceipts) {
      try {
        // Update receipt status
        const { error: updateReceiptError } = await supabase
          .from("receipts")
          .update({
            status: "rejected",
            admin_notes: "ปฏิเสธโดยระบบอัตโนมัติ",
            updated_at: currentTime
          })
          .eq("id", receipt.id);

        if (updateReceiptError) {
          errorCount++;
          errors.push(`Receipt ${receipt.id}: ${updateReceiptError.message}`);
          continue;
        }

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Receipt ${receipt.id}: ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-rejection completed`,
      rejected_count: successCount,
      error_count: errorCount,
      total_non_store_receipts: nonStoreReceipts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Auto-reject error:", error);
    return NextResponse.json(
      { error: "Failed to auto-reject receipts" },
      { status: 500 }
    );
  }
}
