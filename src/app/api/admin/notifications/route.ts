/**
 * GET  /api/admin/notifications — รายการ channel แจ้งทีม (token ถูก mask เสมอ)
 * POST /api/admin/notifications — เพิ่ม channel (telegram: token เข้ารหัสก่อนเก็บ)
 * permission: notifications.manage ทั้งคู่ (MIGRATION_PLAN.md §6.2, §9.5)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { adminAuthError } from '@/lib/admin-http'
import { toPublic, validateCreate } from '@/lib/notification-channels-server'

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE)
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) {
      console.error('[notifications] list failed:', error)
      return NextResponse.json({ error: 'ดึงรายการ channel ไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json((data ?? []).map(toPublic))
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'ดึงรายการ channel ไม่สำเร็จ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE)
    const supabase = createServerSupabaseClient()
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    let parsed: ReturnType<typeof validateCreate>
    try {
      parsed = validateCreate(body)
    } catch (e) {
      // encryptSecret โยนเมื่อไม่มี NOTIFY_TOKEN_KEY — บอกตรง ๆ ไม่เก็บ plaintext
      return NextResponse.json({ error: e instanceof Error ? e.message : 'เข้ารหัส token ไม่สำเร็จ' }, { status: 503 })
    }
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const { data, error } = await supabase.from('notification_channels').insert(parsed.value).select().single()
    if (error) {
      console.error('[notifications] insert failed:', error.code, error.message)
      return NextResponse.json({ error: 'เพิ่ม channel ไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json(toPublic(data), { status: 201 })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'เพิ่ม channel ไม่สำเร็จ' }, { status: 500 })
  }
}
