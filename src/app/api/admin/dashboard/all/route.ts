/**
 * GET /api/admin/dashboard/all?from=YYYY-MM-DD&to=YYYY-MM-DD[&role=]
 * ชุดข้อมูลที่หน้า /admin ใช้ (useDashboard) — Sprint 9R A6
 *   { metrics }   ตัวเลขเดียวกับ /metrics · ไม่ส่ง from/to = เดือนนี้ตามเวลาไทย
 * คืนเฉพาะ metrics — ไม่มีตารางใบเสร็จ/กราฟเก่าแล้ว (กราฟแต้มเป็นงาน Sprint 11)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { computeDashboardMetrics, parseRange, parseRole, NO_STORE_HEADERS } from '@/lib/dashboard-metrics'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW)
    const sp = new URL(request.url).searchParams
    const range = parseRange(sp)
    if ('error' in range) return NextResponse.json({ error: range.error }, { status: 400 })
    const role = parseRole(sp)
    if (typeof role !== 'string') return NextResponse.json({ error: role.error }, { status: 400 })

    const metrics = await computeDashboardMetrics(createServerSupabaseClient(), range, role)
    return NextResponse.json({ metrics }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[dashboard/all] failed:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'ดึงข้อมูลแดชบอร์ดไม่สำเร็จ' }, { status: 500 })
  }
}
