import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission, checkPermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { processReceiptWithGemini, convertThaiDateToISO } from '@/lib/gemini-ocr'
import { createHash } from 'crypto'

async function getBahtPerPoint(supabase: ReturnType<typeof createServerSupabaseClient>) {
  const { data } = await supabase
    .from('point_settings')
    .select('setting_value')
    .eq('setting_key', 'baht_per_point')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.setting_value || null
}

async function quickApproveReceipt(params: {
  supabase: ReturnType<typeof createServerSupabaseClient>
  receiptId: string
  userId: string
  adminId: string
  totalAmount: number | null
  adminNotes?: string | null
}) {
  const { supabase, receiptId, userId, totalAmount, adminNotes } = params

  const { data: userProfile, error: userError } = await supabase
    .from('user_profiles')
    .select('id, points_balance')
    .eq('id', userId)
    .single()

  if (userError || !userProfile) {
    throw new Error('ไม่พบข้อมูลลูกค้าเพื่ออนุมัติ')
  }

  const bahtPerPoint = await getBahtPerPoint(supabase)
  const pointsAwarded = bahtPerPoint && totalAmount
    ? Math.max(Math.floor(totalAmount / bahtPerPoint), 0)
    : 0
  const newBalance = (userProfile.points_balance || 0) + pointsAwarded
  const currentTime = new Date().toISOString()

  const { error: updateUserError } = await supabase
    .from('user_profiles')
    .update({ points_balance: newBalance })
    .eq('id', userProfile.id)

  if (updateUserError) {
    throw new Error('ไม่สามารถอัปเดตแต้มของลูกค้าได้')
  }

  const { error: updateReceiptError } = await supabase
    .from('receipts')
    .update({
      status: 'approved',
      points_awarded: pointsAwarded,
      approved_at: currentTime,
      admin_notes: adminNotes || null,
      updated_at: currentTime,
    })
    .eq('id', receiptId)

  if (updateReceiptError) {
    await supabase
      .from('user_profiles')
      .update({ points_balance: userProfile.points_balance })
      .eq('id', userProfile.id)

    throw new Error('ไม่สามารถอัปเดตสถานะใบเสร็จได้')
  }

  const { error: transactionError } = await supabase
    .from('point_transactions')
    .insert({
      user_id: userProfile.id,
      type: 'earned',
      points: pointsAwarded,
      balance_after: newBalance,
      description: 'Points earned from receipt approval',
      reference_id: receiptId,
      reference_type: 'receipt',
      created_by: null,
      created_at: currentTime,
    })

  if (transactionError) {
    console.warn('Failed to log point transaction', transactionError)
  }

  return {
    points_awarded: pointsAwarded,
    new_balance: newBalance,
    approved_at: currentTime,
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await requirePermission(PERMISSIONS.RECEIPTS_UPLOAD)
    const supabase = createServerSupabaseClient()

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const userId = formData.get('userId') as string | null
    const quickApprove = formData.get('quickApprove') === 'true'
    const adminNotes = (formData.get('adminNotes') as string | null) || null

    if (!imageFile) {
      return NextResponse.json({ error: 'กรุณาเลือกรูปใบเสร็จ' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'กรุณาเลือกลูกค้า' }, { status: 400 })
    }

    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: 'ไฟล์ต้องเป็นรูปภาพเท่านั้น' }, { status: 400 })
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'ขนาดไฟล์ต้องไม่เกิน 10MB' }, { status: 400 })
    }

    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'ไม่พบบัญชีลูกค้าที่เลือก' }, { status: 404 })
    }

    if (quickApprove) {
      const canApprove = await checkPermission(adminUser.id, PERMISSIONS.RECEIPTS_APPROVE)
      if (!canApprove) {
        return NextResponse.json(
          { error: 'คุณไม่มีสิทธิ์อนุมัติใบเสร็จทันที' },
          { status: 403 }
        )
      }
    }

    const ocrResult = await processReceiptWithGemini(imageFile)
    const ocrProcessedAt = new Date().toISOString()

    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileHash = createHash('sha256').update(buffer).digest('hex')

    const timestamp = Date.now()
    const fileName = `receipt-${timestamp}.jpg`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, buffer, {
        contentType: imageFile.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'อัปโหลดรูปภาพไม่สำเร็จ' }, { status: 500 })
    }

    const isoDate = convertThaiDateToISO(ocrResult.วันที่)

    if (isoDate) {
      const { data: existingReceipts, error: duplicateError } = await supabase
        .from('receipts')
        .select('id, total_amount, receipt_date, ocr_data')
        .eq('user_id', userId)
        .eq('receipt_date', isoDate)
        .eq('total_amount', ocrResult.ยอดรวม)

      if (duplicateError) {
        console.warn('Duplicate check error:', duplicateError)
      } else if (existingReceipts && existingReceipts.length > 0) {
        const hasDuplicateStore = existingReceipts.some((receipt) => {
          const existingOcrData = receipt.ocr_data as any
          return existingOcrData?.ชื่อร้าน === ocrResult.ชื่อร้าน
        })

        if (hasDuplicateStore) {
          await supabase.storage.from('receipts').remove([filePath])
          return NextResponse.json(
            {
              error: 'พบใบเสร็จซ้ำ',
              details: 'ใบเสร็จนี้มีข้อมูลใกล้เคียงกับของเดิม',
            },
            { status: 409 }
          )
        }
      }
    }

    const { data: existingImage, error: hashError } = await supabase
      .from('receipt_images')
      .select('id')
      .eq('sha256_hash', fileHash)
      .maybeSingle()

    if (hashError && hashError.code !== 'PGRST116') {
      console.warn('Hash check error:', hashError)
    } else if (existingImage) {
      await supabase.storage.from('receipts').remove([filePath])
      return NextResponse.json(
        {
          error: 'ไฟล์รูปภาพซ้ำ',
          details: 'รูปภาพนี้ถูกอัปโหลดแล้วในระบบ',
        },
        { status: 409 }
      )
    }

    const { data: receiptData, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        user_id: userId,
        status: 'pending' as any,
        ocr_data: ocrResult as any,
        ocr_processed_at: ocrProcessedAt,
        vendor_name: null,
        total_amount: ocrResult.ยอดรวม,
        receipt_date: isoDate,
        receipt_number: null,
        points_awarded: null,
        admin_notes: adminNotes,
        approved_by: null,
        approved_at: null,
        uploaded_by_admin_id: adminUser.id,
      })
      .select()
      .single()

    if (receiptError || !receiptData) {
      console.error('Receipt insert error:', receiptError)
      await supabase.storage.from('receipts').remove([filePath])
      return NextResponse.json({ error: 'บันทึกใบเสร็จไม่สำเร็จ' }, { status: 500 })
    }

    const { width, height } = { width: 1920, height: 1080 }

    const { error: imageError, data: imageData } = await supabase
      .from('receipt_images')
      .insert({
        receipt_id: receiptData.id,
        file_name: fileName,
        file_path: filePath,
        sha256_hash: fileHash,
        file_size: imageFile.size,
        width,
        height,
        mime_type: imageFile.type,
      })
      .select()
      .single()

    if (imageError) {
      console.error('Image record error:', imageError)
      await supabase.storage.from('receipts').remove([filePath])
      await supabase.from('receipts').delete().eq('id', receiptData.id)
      return NextResponse.json({ error: 'บันทึกรูปภาพไม่สำเร็จ' }, { status: 500 })
    }

    let approvalPayload: any = null
    if (quickApprove) {
      try {
        approvalPayload = await quickApproveReceipt({
          supabase,
          receiptId: receiptData.id,
          userId,
          adminId: adminUser.id,
          totalAmount: receiptData.total_amount,
          adminNotes,
        })
        receiptData.status = 'approved'
        receiptData.points_awarded = approvalPayload.points_awarded
        receiptData.approved_at = approvalPayload.approved_at
      } catch (error) {
        console.error('Quick approve error:', error)
        await supabase.storage.from('receipts').remove([filePath])
        await supabase.from('receipt_images').delete().eq('id', imageData.id)
        await supabase.from('receipts').delete().eq('id', receiptData.id)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Quick approve ล้มเหลว' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      receipt: receiptData,
      image: {
        id: imageData.id,
        file_name: fileName,
        file_path: filePath,
      },
      quickApprove: approvalPayload,
    })
  } catch (error) {
    console.error('Admin receipt upload error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปโหลด',
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      },
      { status: 500 }
    )
  }
}
