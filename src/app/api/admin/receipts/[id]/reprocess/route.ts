import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePermission } from "@/lib/admin-auth";
import { PERMISSIONS } from "@/types/admin";
import { processReceiptFromBuffer } from "@/lib/gemini-ocr";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // ต้องมี receipts.approve permission (เพราะ re-check เป็นส่วนหนึ่งของการ approve)
    await requirePermission(PERMISSIONS.RECEIPTS_APPROVE);

    const supabase = createServerSupabaseClient();
    const { id } = await params;

    // Get receipt with image and verify it's in pending status
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .select(`
        *,
        receipt_images (
          id,
          file_path,
          mime_type
        )
      `)
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (receiptError || !receipt) {
      return NextResponse.json(
        { error: "Receipt not found or not in pending status" },
        { status: 404 }
      );
    }

    // Get the first image
    const receiptImages = receipt.receipt_images as any[];
    if (!receiptImages || receiptImages.length === 0) {
      return NextResponse.json(
        { error: "Receipt has no image to process" },
        { status: 400 }
      );
    }

    const image = receiptImages[0];
    const imagePath = image.file_path;

    // Download image from Supabase Storage
    const { data: imageData, error: downloadError } = await supabase
      .storage
      .from("receipts")
      .download(imagePath);

    if (downloadError || !imageData) {
      console.error("Error downloading image:", downloadError);
      return NextResponse.json(
        { error: "Failed to download receipt image" },
        { status: 500 }
      );
    }

    // Convert Blob to Buffer
    const arrayBuffer = await imageData.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Get MIME type from database or blob or default to jpeg
    const mimeType = image.mime_type || imageData.type || 'image/jpeg';

    // Process with Gemini AI
    const ocrResult = await processReceiptFromBuffer(imageBuffer, mimeType);

    // Return the new OCR result without saving (waiting for admin confirmation)
    return NextResponse.json({
      success: true,
      message: "Receipt re-processed successfully (not saved yet)",
      ocr_data: ocrResult,
      ocr_processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("Reprocess receipt error:", error);
    return NextResponse.json(
      {
        error: "Failed to reprocess receipt",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
