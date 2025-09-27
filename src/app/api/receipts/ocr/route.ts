import { NextRequest, NextResponse } from 'next/server'
import { processReceiptWithGemini } from '@/lib/gemini-ocr'

export async function POST(request: NextRequest) {
  try {
    // Get form data
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
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

    // Process image with Gemini AI OCR only (no database upload)
    const ocrResult = await processReceiptWithGemini(imageFile)

    // Return OCR result only
    return NextResponse.json({
      success: true,
      ocrResult: ocrResult
    })

  } catch (error) {
    console.error('OCR processing error:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'OCR processing failed',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}

//TODO: receipt have 5 types