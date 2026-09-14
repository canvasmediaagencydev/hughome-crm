/**
 * POST /api/admin/notifications/:id/test — ส่งข้อความทดสอบเข้า channel นี้ (ไม่สน is_active)
 * ผลลง last_error / last_sent_at เหมือนส่งจริง · ส่งไม่ถึงตอบ 502 พร้อมสาเหตุ (ไม่มี token ใน message)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { TENANT } from '@/config/tenant'
import { adminAuthError } from '@/lib/admin-http'
import { deliverAndRecord } from '@/lib/team-notify'
import { toPublic } from '@/lib/notification-channels-server'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: channel, error } = await supabase.from('notification_channels').select('*').eq('id', id).maybeSingle()
    if (error) {
      console.error('[notifications/test] read failed:', error)
      return NextResponse.json({ error: 'อ่าน channel ไม่สำเร็จ' }, { status: 500 })
    }
    if (!channel) return NextResponse.json({ error: 'ไม่พบ channel นี้' }, { status: 404 })

    const when = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
    const text = `✅ [${TENANT.name}] ทดสอบการแจ้งเตือนจาก Hug Point\nส่งโดย: ${admin.full_name ?? admin.email ?? 'admin'}\nเวลา: ${when}`

    const result = await deliverAndRecord(supabase, channel, text)
    const { data: fresh } = await supabase.from('notification_channels').select('*').eq('id', id).maybeSingle()
    const publicChannel = fresh ? toPublic(fresh) : toPublic(channel)

    if (!result.ok) {
      return NextResponse.json({ error: `ส่งไม่สำเร็จ: ${result.error}`, channel: publicChannel }, { status: 502 })
    }
    return NextResponse.json({ success: true, channel: publicChannel })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'ส่งทดสอบไม่สำเร็จ' }, { status: 500 })
  }
}
