/**
 * PATCH /api/admin/redemptions/:id/status — เดินหน้าสถานะใบแลกทีละขั้น (MIGRATION_PLAN.md §6.2)
 *
 *   requested → approved   (redemptions.process)
 *   approved  → ready      (redemptions.process)
 *   ready     → delivered  (redemptions.deliver) — ส่งมอบของที่หน้าร้าน (สแกน QR หรือกดมือ)
 *
 * ไม่มีเงินขยับที่นี่ (แต้มหักไปแล้วตอน redeem · คืนได้ทางเดียวคือ POST :id/cancel → RPC)
 * UPDATE ใส่เงื่อนไข status เดิมไว้ด้วย → สองคนกดพร้อมกันได้ผลแค่คนเดียว (อีกคนได้ 409)
 * ยกเลิกไม่ได้ผ่านทางนี้ — ต้องไป :id/cancel เท่านั้น
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { checkPermission, isSuperAdmin, requireAdmin } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { adminAuthError } from '@/lib/admin-http'
import {
  NEXT_STATUS,
  REDEMPTION_STATUS_LABEL,
  canAdvance,
  isRedemptionStatus,
  type RedemptionStatus,
} from '@/lib/redemption-status'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // auth ก่อน validate body (ไม่งั้นคนนอกได้ 400 แทน 401) · permission ขึ้นกับสถานะเป้าหมาย จึงเช็คแยกหลังอ่าน body
    const admin = await requireAdmin()

    const body = await request.json().catch(() => ({}))
    const target: unknown = body?.status
    if (!isRedemptionStatus(target) || !(['approved', 'ready', 'delivered'] as RedemptionStatus[]).includes(target)) {
      return NextResponse.json({ error: 'status ต้องเป็น approved | ready | delivered' }, { status: 400 })
    }

    const needed = target === 'delivered' ? PERMISSIONS.REDEMPTIONS_DELIVER : PERMISSIONS.REDEMPTIONS_PROCESS
    const [allowed, superAdmin] = await Promise.all([checkPermission(admin.id, needed), isSuperAdmin(admin.id)])
    if (!allowed && !superAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: current, error: readError } = await supabase
      .from('redemptions')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
    if (readError) {
      console.error('[redemptions/status] read failed:', readError)
      return NextResponse.json({ error: 'อ่านใบแลกไม่สำเร็จ' }, { status: 500 })
    }
    if (!current) return NextResponse.json({ error: 'ไม่พบใบแลกนี้' }, { status: 404 })
    // client ไม่ได้ผูก Database generic → status มาเป็น any · ค่าที่ไม่รู้จัก (ไม่ควรมี) ถือว่าเดินหน้าไม่ได้
    const from: unknown = current.status
    if (!isRedemptionStatus(from)) {
      return NextResponse.json({ error: `สถานะปัจจุบันไม่รู้จัก: ${String(from)}` }, { status: 409 })
    }

    if (!canAdvance(from, target)) {
      const next = NEXT_STATUS[from]
      return NextResponse.json(
        {
          error:
            `เปลี่ยนจาก "${REDEMPTION_STATUS_LABEL[from]}" เป็น "${REDEMPTION_STATUS_LABEL[target]}" ไม่ได้` +
            (next ? ` — ขั้นถัดไปคือ "${REDEMPTION_STATUS_LABEL[next]}"` : ''),
          currentStatus: from,
        },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const notes = typeof body?.adminNotes === 'string' ? body.adminNotes.trim() : undefined
    const update: Record<string, unknown> = { status: target, updated_at: now }
    if (notes) update.admin_notes = notes
    if (target === 'approved') {
      update.processed_by = admin.id
      update.processed_at = now
    }
    if (target === 'delivered') {
      update.delivered_by = admin.id
      update.delivered_at = now
    }

    // เงื่อนไข status เดิม = กัน race (คนอื่นเปลี่ยนไปก่อนแล้ว → 0 แถว → 409)
    const { data, error } = await supabase
      .from('redemptions')
      .update(update)
      .eq('id', id)
      .eq('status', from)
      .select('*, rewards ( id, name ), user_profiles!redemptions_user_id_fkey ( id, display_name, first_name, last_name, phone )')
      .maybeSingle()
    if (error) {
      console.error('[redemptions/status] update failed:', error)
      return NextResponse.json({ error: 'เปลี่ยนสถานะไม่สำเร็จ' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'สถานะถูกเปลี่ยนโดยคนอื่นไปแล้ว กรุณาโหลดใหม่' }, { status: 409 })
    }
    return NextResponse.json({ success: true, redemption: data })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'เปลี่ยนสถานะไม่สำเร็จ' }, { status: 500 })
  }
}
