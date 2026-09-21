/**
 * POST /api/admin/batches/:id/commit — ผู้อนุมัติกด "อนุมัติ" → แต้มเข้าจริง (Sprint 9R A2)
 *
 *   pending_approval → committed   (batches.approve · manager + super_admin)
 *   previewed ตรง ๆ → 409 "ต้องส่งให้ผู้อนุมัติก่อน" (ไม่มี auto-approve)
 *
 * แต้มทั้งหมดเข้าผ่าน RPC award_points_from_batch(p_batch_id, p_admin) เท่านั้น
 * ห้าม UPDATE points_balance / INSERT ledger จากที่นี่ (RPC lock row + all-or-nothing)
 * p_admin มาจาก session เท่านั้น ห้ามรับจาก body — ไม่งั้น audit trail โกหกได้
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { notifyPointChange } from '@/lib/line-messaging'
import { isAwardable, type RowStatus } from '@/lib/excel/parse-sales-batch'

export const runtime = 'nodejs'

interface RawRow {
  status?: string
  user_id?: string | null
  points?: number | null
}

/** แปลง error จาก Postgres/RPC เป็นข้อความที่บัญชีอ่านแล้วรู้ว่าต้องทำอะไรต่อ */
function explainRpcError(err: { code?: string; message?: string }): { status: number; error: string } {
  const msg = err.message ?? ''

  if (err.code === '23505' && msg.includes('bill_no')) {
    return {
      status: 409,
      error:
        'มีเลขที่บิลซ้ำกับที่เคยให้แต้มไปแล้ว — ระบบยกเลิกทั้ง batch ไม่มีแต้มเข้าใคร ' +
        'กรุณาอัปโหลดไฟล์ใหม่ที่แก้เลขบิลแล้ว',
    }
  }
  if (msg.includes('must be pending_approval to commit') || msg.includes('must be previewed to commit')) {
    return { status: 409, error: 'batch นี้ไม่ได้อยู่ในสถานะรอผู้อนุมัติ — ถูกอนุมัติ/ยกเลิกไปแล้ว หรือยังไม่ได้ส่ง' }
  }
  if (msg.includes('outside batch week')) {
    return { status: 409, error: 'มีแถวที่วันที่ซื้ออยู่นอกช่วงสัปดาห์ของ batch — อัปโหลดใหม่โดยเลือกช่วงให้ตรง' }
  }
  if (msg.includes('does not match campaign multiplier') || msg.includes('no longer active/covering')) {
    return {
      status: 409,
      error: 'แคมเปญถูกแก้หลังจากสร้าง preview — ตัวคูณไม่ตรงแล้ว กรุณาอัปโหลดไฟล์ใหม่เพื่อ preview ใหม่',
    }
  }
  if (msg.includes('sales_rep') && msg.includes('not found')) {
    return { status: 409, error: 'มี Maker ในไฟล์ที่ถูกลบออกจากระบบแล้ว — กรุณา preview ใหม่' }
  }
  if (msg.includes('admin') && msg.includes('not found or inactive')) {
    return { status: 403, error: 'บัญชีผู้ใช้ของคุณถูกปิดใช้งาน' }
  }
  return { status: 500, error: 'ให้แต้มไม่สำเร็จ — ไม่มีแต้มเข้าใคร (ทั้ง batch ถูกยกเลิก)' }
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission(PERMISSIONS.BATCHES_APPROVE)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: batch, error: loadErr } = await supabase
      .from('point_batches')
      .select('id, status, raw_rows, file_name')
      .eq('id', id)
      .maybeSingle()

    if (loadErr) {
      console.error('[batches/commit] load failed:', loadErr)
      return NextResponse.json({ error: 'อ่านข้อมูล batch ไม่สำเร็จ' }, { status: 500 })
    }
    if (!batch) return NextResponse.json({ error: 'ไม่พบ batch นี้' }, { status: 404 })
    if (batch.status === 'previewed') {
      return NextResponse.json(
        { error: 'ต้องส่งให้ผู้อนุมัติก่อน — ชุดนี้ยังไม่ได้กด "ส่งให้ผู้อนุมัติ"', currentStatus: batch.status },
        { status: 409 }
      )
    }
    if (batch.status !== 'pending_approval') {
      return NextResponse.json(
        { error: `batch นี้อยู่ในสถานะ "${batch.status}" — อนุมัติได้เฉพาะชุดที่รอผู้อนุมัติ`, currentStatus: batch.status },
        { status: 409 }
      )
    }

    // ---------- ให้แต้ม (all-or-nothing ใน RPC · RPC ล็อกแถวและเช็ค status = pending_approval ซ้ำอีกชั้น) ----------
    const { data: totalPoints, error: rpcErr } = await supabase.rpc('award_points_from_batch', {
      p_batch_id: id,
      p_admin: admin.id,
    })

    if (rpcErr) {
      console.error('[batches/commit] rpc failed:', rpcErr)
      const { status, error } = explainRpcError(rpcErr)
      return NextResponse.json({ error, rpc_message: rpcErr.message }, { status })
    }

    // ---------- LINE push (fire-and-forget · ห้ามทำให้ commit ล้มตาม) ----------
    // รวมแต้มหลายบิลของลูกค้าคนเดียวกันเป็นข้อความเดียว ไม่ยิงซ้ำต่อบิล
    const pointsByUser = new Map<string, number>()
    for (const row of (batch.raw_rows as unknown as RawRow[]) ?? []) {
      // duplicate_amount = ยอดซ้ำที่ผู้อนุมัติเห็นแล้ว — RPC ให้แต้มเหมือน valid (024)
      if (!isAwardable(row?.status as RowStatus) || !row.user_id || !row.points) continue
      pointsByUser.set(row.user_id, (pointsByUser.get(row.user_id) ?? 0) + row.points)
    }

    let notified = 0
    if (pointsByUser.size > 0) {
      const { data: users, error: userErr } = await supabase
        .from('user_profiles')
        .select('id, line_user_id, points_balance')
        .in('id', [...pointsByUser.keys()])

      if (userErr) {
        console.error('[batches/commit] user lookup for push failed:', userErr)
      } else {
        for (const u of users ?? []) {
          const delta = pointsByUser.get(u.id)
          if (!delta || !u.line_user_id) continue
          await notifyPointChange(u.line_user_id, {
            kind: 'batch_award',
            pointsDelta: delta,
            newBalance: u.points_balance ?? 0,
          })
          notified++
        }
      }
    }

    return NextResponse.json({
      batch_id: id,
      status: 'committed',
      total_points: totalPoints,
      customers_awarded: pointsByUser.size,
      line_notified: notified,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[batches/commit] unexpected:', error)
    return NextResponse.json({ error: 'ให้แต้มไม่สำเร็จ' }, { status: 500 })
  }
}
