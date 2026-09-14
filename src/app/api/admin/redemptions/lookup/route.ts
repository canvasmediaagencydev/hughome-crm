/**
 * GET /api/admin/redemptions/lookup?code=XXXXXXXX — หาใบแลกจากรหัสรับของ (สแกน QR ที่หน้าร้าน)
 *
 * อ่านอย่างเดียว (redemptions.view) · การส่งมอบจริงไป PATCH :id/status { status: 'delivered' }
 * QR ของลูกค้า encode เป็น URL /admin/redemptions/scan?code=... → กล้องมือถือเปิดหน้านั้น
 * → หน้านั้นเรียก endpoint นี้แล้วให้แอดมินกดยืนยัน
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { adminAuthError } from '@/lib/admin-http'
import { normalizePickupCode } from '@/lib/redemption-status'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.REDEMPTIONS_VIEW)
    const raw = new URL(request.url).searchParams.get('code') ?? ''
    const code = normalizePickupCode(raw)
    if (!code) {
      return NextResponse.json({ error: 'รหัสรับของต้องเป็นตัวอักษร/ตัวเลข 8 ตัว' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('redemptions')
      .select('*, rewards ( id, name, image_url, points_cost ), user_profiles!redemptions_user_id_fkey ( id, display_name, first_name, last_name, phone )')
      .eq('pickup_code', code)
      .maybeSingle()
    if (error) {
      console.error('[redemptions/lookup] failed:', error)
      return NextResponse.json({ error: 'ค้นหาใบแลกไม่สำเร็จ' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: `ไม่พบใบแลกที่มีรหัส ${code}` }, { status: 404 })
    return NextResponse.json({ redemption: data })
  } catch (error) {
    return adminAuthError(error) ?? NextResponse.json({ error: 'ค้นหาใบแลกไม่สำเร็จ' }, { status: 500 })
  }
}
