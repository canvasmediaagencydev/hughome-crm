/**
 * GET /api/admin/batches/:id — รายละเอียดชุด + แถว preview (raw_rows) — Sprint 5 leftover, ทำใน Sprint 9R
 *
 * ผู้อนุมัติต้องเห็นแถวก่อนกด "อนุมัติ" และบัญชีต้องเปิด preview เดิมได้หลัง reload
 * (เดิมแถวมีแค่ใน response ของ /upload ครั้งแรก — ปิดหน้าแล้วหาย)
 * อ่านอย่างเดียว · batches.view
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import type { ParsedRow } from '@/lib/excel/parse-sales-batch'
import { isAwardable } from '@/lib/excel/parse-sales-batch'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.BATCHES_VIEW)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: batch, error } = await supabase
      .from('point_batches')
      .select(
        'id, file_name, week_start, week_end, status, total_rows, valid_rows, invalid_rows, unmatched_rows, total_points, raw_rows, created_at, submitted_at, committed_at, voided_at, void_reason, uploaded_by, submitted_by, committed_by, voided_by'
      )
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[batches/:id] load failed:', error)
      return NextResponse.json({ error: 'อ่านข้อมูล batch ไม่สำเร็จ' }, { status: 500 })
    }
    if (!batch) return NextResponse.json({ error: 'ไม่พบ batch นี้' }, { status: 404 })

    const adminIds = [
      ...new Set([batch.uploaded_by, batch.submitted_by, batch.committed_by, batch.voided_by].filter((x): x is string => !!x)),
    ]
    const nameById = new Map<string, string>()
    if (adminIds.length) {
      const { data: admins } = await supabase.from('admin_users').select('id, full_name, email').in('id', adminIds)
      for (const a of admins ?? []) nameById.set(a.id, a.full_name?.trim() || a.email)
    }
    const who = (aid: string | null) => (aid ? nameById.get(aid) ?? '(ถูกลบ)' : null)

    // raw_rows เก่า (ก่อน 9R) ไม่มี warnings/duplicate_of_row/customer_code — เติมค่าว่างให้ UI ใช้ shape เดียว
    const rows = ((batch.raw_rows as unknown as Partial<ParsedRow>[]) ?? []).map((r) => ({
      ...r,
      customer_code: r.customer_code ?? null,
      warnings: r.warnings ?? [],
      duplicate_of_row: r.duplicate_of_row ?? null,
    })) as ParsedRow[]

    const summary = {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      duplicate_amount: rows.filter((r) => r.status === 'duplicate_amount').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      unmatched: rows.filter((r) => r.status === 'unmatched').length,
      warned: rows.filter((r) => r.warnings.length > 0).length,
      total_points: rows.filter((r) => isAwardable(r.status)).reduce((n, r) => n + (r.points ?? 0), 0),
    }

    const { raw_rows: _raw, ...rest } = batch
    void _raw
    return NextResponse.json({
      ...rest,
      uploaded_by_name: who(batch.uploaded_by),
      submitted_by_name: who(batch.submitted_by),
      committed_by_name: who(batch.committed_by),
      voided_by_name: who(batch.voided_by),
      summary,
      rows,
    })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'อ่านข้อมูล batch ไม่สำเร็จ' }, { status: 500 })
  }
}
