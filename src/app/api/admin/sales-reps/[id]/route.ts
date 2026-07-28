/**
 * PATCH /api/admin/sales-reps/:id — แก้ชื่อ/เบอร์ หรือเปิด-ปิดใช้งาน
 *
 * ไม่มี DELETE โดยตั้งใจ — FK ledger เป็น ON DELETE RESTRICT (ประวัติต้องสาวกลับได้)
 * "ลาออก" = is_active: false → หายจาก dropdown ของ template รอบถัดไป
 * แต่ยอดเก่าที่เขายังคีย์ไว้ commit ได้ปกติ (RPC ไม่บังคับ is_active)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { normalizeThaiPhone } from '@/lib/phone'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.SALESREPS_MANAGE)
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const body = await request.json().catch(() => ({}))

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.full_name !== undefined) {
      const fullName = String(body.full_name).trim()
      if (fullName.length < 1 || fullName.length > 120) {
        return NextResponse.json({ error: 'ชื่อ-สกุลต้องยาว 1–120 ตัวอักษร' }, { status: 400 })
      }
      update.full_name = fullName
    }

    if (body.phone !== undefined) {
      const raw = String(body.phone ?? '').trim()
      if (!raw) {
        update.phone = null
      } else {
        const phone = normalizeThaiPhone(raw)
        if (!phone) return NextResponse.json({ error: `เบอร์โทรไม่ถูกต้อง: "${raw}"` }, { status: 400 })
        update.phone = phone
      }
    }

    if (body.is_active !== undefined) update.is_active = Boolean(body.is_active)

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' }, { status: 400 })
    }

    const { data, error } = await supabase.from('sales_reps').update(update).eq('id', id).select().single()

    if (error) {
      console.error('[sales-reps] update failed:', error)
      return NextResponse.json({ error: 'แก้ไขพนักงานขายไม่สำเร็จ' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'ไม่พบพนักงานขายคนนี้' }, { status: 404 })

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[sales-reps] unexpected:', error)
    return NextResponse.json({ error: 'แก้ไขพนักงานขายไม่สำเร็จ' }, { status: 500 })
  }
}
