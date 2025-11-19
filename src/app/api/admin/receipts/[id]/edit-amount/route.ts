import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    await requireAdmin()

    const supabase = createServerSupabaseClient()
    const { id: receiptId } = await params
    const body = await request.json()
    const { total_amount, is_valid_store } = body

    if (typeof total_amount !== 'number' || total_amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Get current receipt to update OCR data
    const { data: currentReceipt } = await supabase
      .from('receipts')
      .select('ocr_data')
      .eq('id', receiptId)
      .single()

    // Update OCR data with new store status
    const updatedOcrData = {
      ...(currentReceipt?.ocr_data || {}),
      ชื่อร้าน: is_valid_store ?? (currentReceipt?.ocr_data as any)?.ชื่อร้าน ?? false
    }

    // Update receipt amount and OCR data
    const { data: receipt, error: updateError } = await supabase
      .from('receipts')
      .update({
        total_amount: total_amount,
        ocr_data: updatedOcrData,
        updated_at: new Date().toISOString()
      })
      .eq('id', receiptId)
      .select()
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update receipt' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      receipt: receipt
    })

  } catch (error) {
    console.error('Edit amount error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to edit amount',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
