/**
 * PATCH  /api/admin/notifications/:id — เปิด/ปิด, เปลี่ยน events, กรอก token ใหม่ (telegram)
 * DELETE /api/admin/notifications/:id — ลบ channel (ไม่มีตารางไหนอ้างถึง ลบได้จริง)
 * permission: notifications.manage
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { adminAuthError } from '@/lib/admin-http'
import { toPublic, validatePatch } from '@/lib/notification-channels-server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE)
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const { data: current, error: readError } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (readError) {
      console.error('[notifications] read failed:', readError)
      return NextResponse.json({ error: 'อ่าน channel ไม่สำเร็จ' }, { status: 500 })
    }
    if (!current) return NextResponse.json({ error: 'ไม่พบ channel นี้' }, { status: 404 })

    let parsed: ReturnType<typeof validatePatch>
    try {
      parsed = validatePatch(current, body)
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'เข้ารหัส token ไม่สำเร็จ' }, { status: 503 })
    }
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const { data, error } = await supabase
      .from('notification_channels')
      .update(parsed.value)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      console.error('[notifications] update failed:', error.code, error.message)
      return NextResponse.json({ error: 'แก้ไข channel ไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json(toPublic(data))
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'แก้ไข channel ไม่สำเร็จ' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE)
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.from('notification_channels').delete().eq('id', id).select('id').maybeSingle()
    if (error) {
      console.error('[notifications] delete failed:', error)
      return NextResponse.json({ error: 'ลบ channel ไม่สำเร็จ' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'ไม่พบ channel นี้' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'ลบ channel ไม่สำเร็จ' }, { status: 500 })
  }
}
