/**
 * POST /api/admin/batches/:id/submit — ส่งชุดที่ preview แล้วให้ผู้อนุมัติ (Sprint 9R A2)
 *
 *   previewed → pending_approval   (batches.upload)
 *
 * ไม่มีเงินขยับที่นี่ — แต้มเข้าเมื่อผู้อนุมัติกด POST /:id/commit (RPC award_points_from_batch) เท่านั้น
 * UPDATE ใส่เงื่อนไข status เดิม → สองคนกดพร้อมกันได้ผลแค่คนเดียว (อีกคนได้ 409) แบบเดียวกับ redemptions/[id]/status
 * แจ้งทีม (Telegram / LINE group) หลังจากบันทึกแล้ว · แจ้งล้มต้องไม่ทำให้ submit ล้มตาม
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { buildBatchSubmittedText, notifyTeam } from '@/lib/team-notify'
import { TENANT } from '@/config/tenant'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission(PERMISSIONS.BATCHES_UPLOAD)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: batch, error: loadErr } = await supabase
      .from('point_batches')
      .select('id, status, file_name, week_start, week_end, total_rows, valid_rows, total_points')
      .eq('id', id)
      .maybeSingle()
    if (loadErr) {
      console.error('[batches/submit] load failed:', loadErr)
      return NextResponse.json({ error: 'อ่านข้อมูล batch ไม่สำเร็จ' }, { status: 500 })
    }
    if (!batch) return NextResponse.json({ error: 'ไม่พบ batch นี้' }, { status: 404 })
    if (batch.status !== 'previewed') {
      return NextResponse.json(
        { error: `batch นี้อยู่ในสถานะ "${batch.status}" — ส่งให้ผู้อนุมัติได้เฉพาะชุดที่ยัง previewed`, currentStatus: batch.status },
        { status: 409 }
      )
    }
    if (batch.valid_rows <= 0) {
      return NextResponse.json({ error: 'ชุดนี้ไม่มีแถวที่ใช้ได้เลย — แก้ไฟล์แล้วอัปโหลดใหม่' }, { status: 409 })
    }

    const now = new Date().toISOString()
    const { data: updated, error: updErr } = await supabase
      .from('point_batches')
      .update({ status: 'pending_approval', submitted_by: admin.id, submitted_at: now })
      .eq('id', id)
      .eq('status', 'previewed')
      .select('id, status, submitted_at')
      .maybeSingle()
    if (updErr) {
      console.error('[batches/submit] update failed:', updErr)
      return NextResponse.json({ error: 'ส่งให้ผู้อนุมัติไม่สำเร็จ' }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'สถานะถูกเปลี่ยนโดยคนอื่นไปแล้ว กรุณาโหลดใหม่' }, { status: 409 })
    }

    // ---------- แจ้งทีม (หลังตอบแล้ว · ไม่ throw) ----------
    const adminUrl = new URL('/admin/batches', request.url).toString()
    const text = buildBatchSubmittedText({
      tenantName: TENANT.name,
      submitterName: admin.full_name?.trim() || admin.email,
      fileName: batch.file_name,
      weekStart: batch.week_start,
      weekEnd: batch.week_end,
      awardableRows: batch.valid_rows,
      totalRows: batch.total_rows,
      totalPoints: batch.total_points,
      adminUrl,
    })
    after(() => notifyTeam(supabase, 'batch.submitted', text))

    return NextResponse.json({ batch_id: id, status: 'pending_approval', submitted_at: updated.submitted_at })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'ส่งให้ผู้อนุมัติไม่สำเร็จ' }, { status: 500 })
  }
}
