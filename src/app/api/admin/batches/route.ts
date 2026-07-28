/**
 * GET /api/admin/batches — รายการ batch + ชื่อบัญชี actor ทั้ง 4
 *
 * actor 4 คนต่อ batch เป็นคนละคนได้ ห้ามยุบเป็นช่องเดียว (MIGRATION_PLAN.md §4.2):
 *   uploaded_by (ใครส่งไฟล์) · committed_by (ใครกดให้แต้มเข้า)
 *   reviewed_by (ใครสุ่มตรวจ) · voided_by (ใครยกเลิก)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.BATCHES_VIEW)
    const supabase = createServerSupabaseClient()
    const sp = new URL(request.url).searchParams

    const status = sp.get('status')
    const weekFrom = sp.get('week_from')
    const weekTo = sp.get('week_to')
    const limit = Math.min(Number(sp.get('limit') ?? 50) || 50, 200)

    let query = supabase
      .from('point_batches')
      // ต้องเป็น string literal ตัวเดียว — ถ้าต่อ string supabase-js จะ infer type ไม่ออก
      .select(
        'id, file_name, week_start, week_end, status, total_rows, valid_rows, invalid_rows, unmatched_rows, total_points, created_at, committed_at, reviewed_at, review_note, voided_at, void_reason, uploaded_by, committed_by, reviewed_by, voided_by'
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status as 'draft' | 'previewed' | 'committed' | 'voided')
    if (weekFrom) query = query.gte('week_start', weekFrom)
    if (weekTo) query = query.lte('week_end', weekTo)

    const { data: batches, error } = await query
    if (error) {
      console.error('[batches] list failed:', error)
      return NextResponse.json({ error: 'ดึงรายการ batch ไม่สำเร็จ' }, { status: 500 })
    }

    // resolve ชื่อ admin ทีเดียว — join ผ่าน PostgREST ทำไม่ได้สวยเพราะมี 4 FK ไปตารางเดียวกัน
    const adminIds = [
      ...new Set(
        (batches ?? []).flatMap((b) =>
          [b.uploaded_by, b.committed_by, b.reviewed_by, b.voided_by].filter((x): x is string => !!x)
        )
      ),
    ]
    const nameById = new Map<string, string>()
    if (adminIds.length) {
      const { data: admins } = await supabase.from('admin_users').select('id, full_name, email').in('id', adminIds)
      for (const a of admins ?? []) nameById.set(a.id, a.full_name?.trim() || a.email)
    }
    const who = (id: string | null) => (id ? nameById.get(id) ?? '(ถูกลบ)' : null)

    return NextResponse.json(
      (batches ?? []).map((b) => ({
        ...b,
        uploaded_by_name: who(b.uploaded_by),
        committed_by_name: who(b.committed_by),
        reviewed_by_name: who(b.reviewed_by),
        voided_by_name: who(b.voided_by),
      }))
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[batches] unexpected:', error)
    return NextResponse.json({ error: 'ดึงรายการ batch ไม่สำเร็จ' }, { status: 500 })
  }
}
