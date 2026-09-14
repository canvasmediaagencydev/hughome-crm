/**
 * GET /api/admin/quota — LINE message quota (cache 15 นาที · ?refresh=1 บังคับดึงใหม่)
 * permission dashboard.view
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { getLineQuota } from '@/lib/line-quota'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.DASHBOARD_VIEW)
    const supabase = createServerSupabaseClient()
    const force = new URL(request.url).searchParams.get('refresh') === '1'
    const quota = await getLineQuota(supabase, force ? 0 : undefined)
    if (!quota) return NextResponse.json({ error: 'ดึง quota จาก LINE ไม่สำเร็จ และยังไม่มี cache' }, { status: 502 })
    return NextResponse.json(quota)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[quota] unexpected:', error)
    return NextResponse.json({ error: 'ดึง quota ไม่สำเร็จ' }, { status: 500 })
  }
}
