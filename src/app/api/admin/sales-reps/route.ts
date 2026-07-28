/**
 * GET  /api/admin/sales-reps  — รายชื่อพนักงานขาย (ป้อน dropdown ในไฟล์ Excel)
 * POST /api/admin/sales-reps  — เพิ่มพนักงานขาย
 *
 * ไม่มี DELETE โดยตั้งใจ — ledger อ้าง sales_rep_id ด้วย FK ON DELETE RESTRICT
 * ลาออกให้ปิด is_active (PATCH /:id) ประวัติยอดเก่าต้องสาวกลับได้เสมอ
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { normalizeThaiPhone } from '@/lib/phone'
import SPEC from '@/lib/excel/sales-columns.json'

/** ต้องตรงกับ CHECK sales_reps_code_format ใน migration 013 */
const CODE_RE = /^[A-Za-z0-9_-]{1,16}$/

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.SALESREPS_VIEW)
    const supabase = createServerSupabaseClient()
    const activeOnly = new URL(request.url).searchParams.get('active') === 'true'

    let query = supabase.from('sales_reps').select('*').order('code')
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) {
      console.error('[sales-reps] list failed:', error)
      return NextResponse.json({ error: 'ดึงรายชื่อพนักงานขายไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'ดึงรายชื่อพนักงานขายไม่สำเร็จ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePermission(PERMISSIONS.SALESREPS_MANAGE)
    const supabase = createServerSupabaseClient()
    const body = await request.json().catch(() => ({}))

    const code = String(body.code ?? '').trim()
    const fullName = String(body.full_name ?? '').trim()
    const phoneRaw = String(body.phone ?? '').trim()

    if (!CODE_RE.test(code)) {
      return NextResponse.json(
        { error: 'รหัสพนักงานต้องเป็น A-Z a-z 0-9 _ - ยาว 1–16 ตัว (ห้ามเว้นวรรค/อักขระพิเศษ)' },
        { status: 400 }
      )
    }
    if (code.includes(SPEC.salesRepSeparator)) {
      return NextResponse.json({ error: `รหัสพนักงานห้ามมี "${SPEC.salesRepSeparator}"` }, { status: 400 })
    }
    if (fullName.length < 1 || fullName.length > 120) {
      return NextResponse.json({ error: 'ชื่อ-สกุลต้องยาว 1–120 ตัวอักษร' }, { status: 400 })
    }

    let phone: string | null = null
    if (phoneRaw) {
      phone = normalizeThaiPhone(phoneRaw)
      if (!phone) {
        return NextResponse.json({ error: `เบอร์โทรไม่ถูกต้อง: "${phoneRaw}"` }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('sales_reps')
      .insert({ code, full_name: fullName, phone, created_by: admin.id })
      .select()
      .single()

    if (error) {
      // 23505 = ชน unique index บน upper(code)
      if (error.code === '23505') {
        return NextResponse.json({ error: `มีรหัสพนักงาน "${code}" อยู่แล้ว` }, { status: 409 })
      }
      console.error('[sales-reps] insert failed:', error)
      return NextResponse.json({ error: 'เพิ่มพนักงานขายไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'เพิ่มพนักงานขายไม่สำเร็จ' }, { status: 500 })
  }
}
