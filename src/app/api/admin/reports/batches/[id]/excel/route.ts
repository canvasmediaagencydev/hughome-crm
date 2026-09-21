/**
 * GET /api/admin/reports/batches/:id/excel — รายงานชุดยอดขายรายสัปดาห์สำหรับผู้อนุมัติ/ผู้จัดการ
 * (MIGRATION_PLAN.md §8.2 · wiki/12 §5 · Sprint 9R A5)
 *
 *   1 แถว = 1 บิล · "มีเลขที่บิลโดยตั้งใจ" (ใช้เทียบบิลกระดาษ) ห้ามลบคอลัมน์นี้
 *   วันที่ซื้อ, เลขบิล, รหัสลูกค้า, เบอร์ (ไม่มีขีด), ชื่อ, ยอดซื้อ, ลดหนี้, สุทธิ, ตัวคูณ, แต้ม, Maker, สาขา · แถวท้าย: รวม
 *
 * ข้อมูลมาจาก raw_rows ของชุด (แถวที่จะได้/ได้แต้ม: valid + duplicate_amount) — ตรงกับที่ RPC ให้แต้ม
 * ชื่อ/รหัสลูกค้าดึงสดจาก user_profiles (raw_rows เก็บชื่อที่ Maker พิมพ์มา อาจไม่ตรง)
 * batches.view
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { TENANT } from '@/config/tenant'
import { isAwardable, type ParsedRow } from '@/lib/excel/parse-sales-batch'
import { buildBatchReport, batchReportFilename, XLSX_MIME } from '@/lib/excel/build-reports'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.BATCHES_VIEW)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: batch, error } = await supabase
      .from('point_batches')
      .select(
        'id, file_name, week_start, week_end, status, raw_rows, committed_at, void_reason, uploaded_by, submitted_by, committed_by, voided_by'
      )
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('[reports/batches/excel] load failed:', error)
      return NextResponse.json({ error: 'อ่านข้อมูล batch ไม่สำเร็จ' }, { status: 500 })
    }
    if (!batch) return NextResponse.json({ error: 'ไม่พบ batch นี้' }, { status: 404 })

    const rows = ((batch.raw_rows as unknown as Partial<ParsedRow>[]) ?? []).filter(
      (r): r is ParsedRow => !!r.status && isAwardable(r.status)
    )

    // ชื่อ + รหัสลูกค้าจากระบบ (ไม่ใช่ที่พิมพ์มาในไฟล์)
    const userIds = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))]
    const userById = new Map<string, { customer_code: string | null; name: string }>()
    for (let i = 0; i < userIds.length; i += 200) {
      const { data: users, error: uErr } = await supabase
        .from('user_profiles')
        .select('id, customer_code, first_name, last_name, display_name')
        .in('id', userIds.slice(i, i + 200))
      if (uErr) {
        console.error('[reports/batches/excel] users failed:', uErr)
        return NextResponse.json({ error: 'ดึงข้อมูลลูกค้าไม่สำเร็จ' }, { status: 500 })
      }
      for (const u of users ?? []) {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.display_name || ''
        userById.set(u.id, { customer_code: u.customer_code ?? null, name })
      }
    }

    const adminIds = [
      ...new Set([batch.uploaded_by, batch.submitted_by, batch.committed_by, batch.voided_by].filter((x): x is string => !!x)),
    ]
    const nameById = new Map<string, string>()
    if (adminIds.length) {
      const { data: admins } = await supabase.from('admin_users').select('id, full_name, email').in('id', adminIds)
      for (const a of admins ?? []) nameById.set(a.id, a.full_name?.trim() || a.email)
    }
    const who = (aid: string | null) => (aid ? nameById.get(aid) ?? '(ถูกลบ)' : null)

    const wb = buildBatchReport({
      branchName: TENANT.name,
      batch: {
        file_name: batch.file_name,
        week_start: batch.week_start,
        week_end: batch.week_end,
        status: batch.status,
        uploaded_by_name: who(batch.uploaded_by),
        submitted_by_name: who(batch.submitted_by),
        committed_by_name: who(batch.committed_by),
        committed_at: batch.committed_at,
        voided_by_name: who(batch.voided_by),
        void_reason: batch.void_reason,
      },
      rows: rows.map((r) => {
        const u = r.user_id ? userById.get(r.user_id) : undefined
        return {
          purchase_date: r.purchase_date,
          bill_no: r.bill_no,
          customer_code: u?.customer_code ?? r.customer_code ?? null,
          phone: r.phone,
          customer_name: u?.name || r.customer_name || null,
          gross: r.gross,
          discount: r.discount,
          net: r.net,
          multiplier: r.multiplier,
          points: r.points,
          sales_rep: r.sales_rep_code && r.sales_rep_name ? `${r.sales_rep_code} · ${r.sales_rep_name}` : r.sales_rep_name,
        }
      }),
    })
    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${batchReportFilename(batch)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[reports/batches/excel] unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'สร้างรายงานไม่สำเร็จ' }, { status: 500 })
  }
}
