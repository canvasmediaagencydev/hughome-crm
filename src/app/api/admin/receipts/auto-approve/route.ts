import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
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
        approved_count: 0
      });
    }

    // Get point setting for calculation
    const { data: pointSettings } = await supabase
      .from("point_settings")
      .select("*")
      .eq("setting_key", "baht_per_point")
      .single();

    const bahtPerPoint = pointSettings?.setting_value || 100;

    // Filter receipts that are from "ตั้งหง่วงเซ้ง" store
    const storeReceipts = receipts.filter(receipt => {
      const ocrData = receipt.ocr_data;
      if (!ocrData || typeof ocrData !== 'object') return false;

      const storeField = (ocrData as any).ชื่อร้าน || (ocrData as any)["ชื่อร้าน"];
      return storeField === true; // Only approve if store field is exactly true
    });

    if (storeReceipts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No store receipts found to auto-approve",
        approved_count: 0
      });
    }

    const currentTime = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each store receipt
    for (const receipt of storeReceipts) {
      try {
        const user = receipt.user_profiles;
        if (!user || !receipt.total_amount) {
          errorCount++;
          errors.push(`Receipt ${receipt.id}: Missing user or amount data`);
          continue;
        }

        // Calculate points
        const pointsAwarded = Math.floor(receipt.total_amount / bahtPerPoint);
        const newPointsBalance = (user.points_balance || 0) + pointsAwarded;

        // Update receipt status
        const { error: updateReceiptError } = await supabase
          .from("receipts")
          .update({
            status: "approved",
            points_awarded: pointsAwarded,
            admin_notes: "อนุมัติโดยระบบอัตโนมัติ (ใบเสร็จของร้าน)",
            approved_at: currentTime,
            approved_by: null,
            updated_at: currentTime
          })
          .eq("id", receipt.id);

        if (updateReceiptError) {
          errorCount++;
          errors.push(`Receipt ${receipt.id}: ${updateReceiptError.message}`);
          continue;
        }

        // Note: user_profiles.points_balance will be auto-updated by database trigger

        // Create point transaction record (trigger will auto-set balance_after and sync user_profiles)
        const { error: transactionError } = await supabase
          .from("point_transactions")
          .insert({
            user_id: user.id,
            type: "earned",
            points: pointsAwarded,
            balance_after: newPointsBalance,
            description: "Points earned from auto-approved store receipt",
            reference_id: receipt.id,
            reference_type: "receipt",
            created_by: null,
            created_at: currentTime
          });

        if (transactionError) {
          // Don't fail the whole operation for transaction log failure
          console.error("Transaction log error:", transactionError);
        }

        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Receipt ${receipt.id}: ${error}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Auto-approval completed`,
      approved_count: successCount,
      error_count: errorCount,
      total_store_receipts: storeReceipts.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Auto-approve error:", error);
    return NextResponse.json(
      { error: "Failed to auto-approve receipts" },
      { status: 500 }
    );
  }
}