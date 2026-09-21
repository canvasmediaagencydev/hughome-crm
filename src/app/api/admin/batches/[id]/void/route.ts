/**
 * POST /api/admin/batches/:id/void — "ยกเลิกทั้งชุด (Rollback)"
 *
 *   committed        → voided  คืนแต้มทุกคนในชุด ปลดล็อกเลขบิล
 *   pending_approval → voided  ผู้อนุมัติ "ปฏิเสธ" ก่อนแต้มเข้า (ไม่มี ledger ให้คืน · 024)
 *
 * ทำผ่าน RPC void_batch เท่านั้น (คืนแต้ม + มาร์ค voided ทุกแถวในทรานแซกชันเดียว)
 * การมาร์ค voided=true คือสิ่งที่ปลดล็อกเลขบิลให้คีย์ใหม่ได้ — ห้ามเขียน logic นี้ซ้ำที่นี่
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission(PERMISSIONS.BATCHES_VOID)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const body = await request.json().catch(() => ({}))
    const reason = String(body.reason ?? '').trim()
    if (reason.length < 3) {
      // บังคับให้ระบุเหตุผล — void คือการดึงแต้มคืนจากลูกค้า ต้องตอบได้ว่าทำไม
      return NextResponse.json({ error: 'ต้องระบุเหตุผลการยกเลิก (อย่างน้อย 3 ตัวอักษร)' }, { status: 400 })
    }

    const { error } = await supabase.rpc('void_batch', {
      p_batch_id: id,
      p_admin: admin.id,
      p_reason: reason,
    })

    if (error) {
      console.error('[batches/void] rpc failed:', error)
      if (error.message?.includes('can be voided')) {
        return NextResponse.json(
          { error: 'ยกเลิกได้เฉพาะชุดที่แต้มเข้าแล้ว หรือชุดที่รอผู้อนุมัติ (ชุด previewed ให้อัปโหลดไฟล์ใหม่ทับได้เลย)' },
          { status: 409 }
        )
      }
      if (error.message?.includes('not found')) {
        return NextResponse.json({ error: 'ไม่พบ batch นี้' }, { status: 404 })
      }
      return NextResponse.json({ error: 'ยกเลิก batch ไม่สำเร็จ' }, { status: 500 })
    }

    return NextResponse.json({ batch_id: id, status: 'voided', reason })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[batches/void] unexpected:', error)
    return NextResponse.json({ error: 'ยกเลิก batch ไม่สำเร็จ' }, { status: 500 })
  }
}
