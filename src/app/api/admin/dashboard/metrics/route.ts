/**
 * GET /api/admin/dashboard/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD[&role=]
 * ตัวเลขบน /admin (Sprint 9R A6) — ไม่ส่ง from/to = เดือนนี้ตามเวลาไทย
 * ตรรกะอยู่ที่ src/lib/dashboard-metrics.ts (ใช้ร่วมกับ /all)
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
    return NextResponse.json(metrics, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error('[dashboard/metrics] failed:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'ดึงตัวเลขแดชบอร์ดไม่สำเร็จ' }, { status: 500 })
  }
}
