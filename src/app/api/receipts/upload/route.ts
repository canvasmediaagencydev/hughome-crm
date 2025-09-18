import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { processReceiptWithGemini, convertThaiDateToISO } from '@/lib/gemini-ocr'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const userId = formData.get('userId') as string

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Process image with Gemini AI OCR
    const ocrResult = await processReceiptWithGemini(imageFile)

    // Create file hash for duplicate detection
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileHash = createHash('sha256').update(buffer).digest('hex')

    // Generate unique filename
    const timestamp = Date.now()
    const fileName = `receipt-${timestamp}.jpg`
    const filePath = `receipts/${userId}/${fileName}`

    // Upload image to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, buffer, {
        contentType: imageFile.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      )
    }

    // Convert Thai date to ISO format
    const isoDate = convertThaiDateToISO(ocrResult.วันที่)

    // Insert receipt record
    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        status: 'pending' as any,
        ocr_data: ocrResult as any,
        vendor_name: null, // We store this info in ocr_data instead
        total_amount: ocrResult.ยอดรวม,
        receipt_date: isoDate,
        receipt_number: null,
        points_awarded: null,
        admin_notes: null,
        approved_by: null,
        approved_at: null
      })
      .select()
      .single()

    if (receiptError) {
      console.error('Receipt insert error:', receiptError)

      // Clean up uploaded file on error
      await supabase.storage
        .from('receipts')
        .remove([filePath])

      return NextResponse.json(
        { error: 'Failed to save receipt data' },
        { status: 500 }
      )
    }


    // Get image dimensions (simple approach)
    const getImageDimensions = () => {
      return new Promise<{ width: number; height: number }>((resolve) => {
        // For now, return placeholder dimensions
        // In a real implementation, you might want to get actual dimensions
        resolve({ width: 1920, height: 1080 })
      })
    }

    const { width, height } = await getImageDimensions()

    // Insert receipt image record
    const { data: imageData, error: imageError } = await supabase
      .from('receipt_images')
      .insert({
        receipt_id: receiptData.id,
        file_name: fileName,
        file_path: filePath,
        sha256_hash: fileHash,
        file_size: imageFile.size,
        width: width,
        height: height,
        mime_type: imageFile.type
      })
      .select()
      .single()

    if (imageError) {
      console.error('Image record insert error:', imageError)

      // Clean up on error
      await supabase.storage
        .from('receipts')
        .remove([filePath])

      await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptData.id)

      return NextResponse.json(
        { error: 'Failed to save image data' },
        { status: 500 }
      )
    }


    // Return success response
    return NextResponse.json({
      success: true,
      receipt: {
        id: receiptData.id,
        ocr_data: ocrResult,
        total_amount: ocrResult.ยอดรวม,
        receipt_date: isoDate,
        status: 'pending',
        confidence: ocrResult.ความถูกต้อง
      },
      image: {
        id: imageData.id,
        file_name: fileName,
        file_path: filePath
      }
    })

  } catch (error) {
    console.error('Receipt upload error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Upload failed',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}