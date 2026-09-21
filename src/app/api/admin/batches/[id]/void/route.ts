/**
 * POST /api/admin/batches/:id/void — "ยกเลิกทั้งชุด (Rollback)" / "ปฏิเสธ"
 *
 *   committed        → voided  คืนแต้มทุกคนในชุด ปลดล็อกเลขบิล      · ต้องมี batches.void (Q3: super_admin เท่านั้น · 026)
 *   pending_approval → voided  ผู้อนุมัติ "ปฏิเสธ" ก่อนแต้มเข้า (ไม่มี ledger) · ต้องมี batches.approve (ผู้อนุมัติ)
 *
 * สิทธิ์ขึ้นกับสถานะ จึงต้องอ่านสถานะก่อนเช็ค permission (แบบเดียวกับ redemptions/[id]/status)
 *
 * ทำผ่าน RPC void_batch เท่านั้น (คืนแต้ม + มาร์ค voided ทุกแถวในทรานแซกชันเดียว)
 * การมาร์ค voided=true คือสิ่งที่ปลดล็อกเลขบิลให้คีย์ใหม่ได้ — ห้ามเขียน logic นี้ซ้ำที่นี่
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkPermission, isSuperAdmin, requireAdmin } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // auth ก่อน validate (คนนอกต้องได้ 401 ไม่ใช่ 400) · permission เช็คหลังรู้สถานะ
    const admin = await requireAdmin()
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: batch, error: loadErr } = await supabase.from('point_batches').select('id, status').eq('id', id).maybeSingle()
    if (loadErr) {
      console.error('[batches/void] load failed:', loadErr)
      return NextResponse.json({ error: 'อ่านข้อมูล batch ไม่สำเร็จ' }, { status: 500 })
    }
    if (!batch) return NextResponse.json({ error: 'ไม่พบ batch นี้' }, { status: 404 })

    // ปฏิเสธชุดที่รอ = งานผู้อนุมัติ · Rollback ชุดที่แต้มเข้าแล้ว = admin สูงสุดเท่านั้น (Q3)
    const needed = batch.status === 'pending_approval' ? PERMISSIONS.BATCHES_APPROVE : PERMISSIONS.BATCHES_VOID
    const [allowed, superAdmin] = await Promise.all([checkPermission(admin.id, needed), isSuperAdmin(admin.id)])
    if (!allowed && !superAdmin) {
      return NextResponse.json(
        {
          error:
            batch.status === 'pending_approval'
              ? 'Forbidden — ปฏิเสธชุดได้เฉพาะผู้อนุมัติ'
              : 'Forbidden — ยกเลิกทั้งชุด (Rollback) ได้เฉพาะ admin สูงสุด',
        },
        { status: 403 }
      )
    }

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
