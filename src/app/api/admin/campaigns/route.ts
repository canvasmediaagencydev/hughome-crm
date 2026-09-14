/**
 * GET  /api/admin/campaigns  — รายการแคมเปญตัวคูณ (permission campaigns.view)
 * POST /api/admin/campaigns  — สร้างแคมเปญ (permission campaigns.manage)
 *
 * ตัวคูณตั้งจากหลังบ้านเท่านั้น — role accounting มีแค่ campaigns.view จึงยิง POST แล้วได้ 403
 * (คนคีย์ยอดต้องไม่ใช่คนตั้งตัวคูณ · MIGRATION_PLAN.md §9.7)
 *
 * ช่วงของแคมเปญที่ active ห้ามซ้อน — DB บังคับด้วย EXCLUDE point_campaigns_no_overlap
 * ที่นี่เช็คก่อนยิงเพื่อบอกชื่อตัวที่ทับได้ และแปล 23P01 (กรณี race) ให้เป็นข้อความเดียวกัน
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { overlapMessage, validateCampaignFields } from '@/lib/campaigns'
import { campaignAuthError as authError, findConflict } from '@/lib/campaigns-server'

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.CAMPAIGNS_VIEW)
    const supabase = createServerSupabaseClient()
    const activeOnly = new URL(request.url).searchParams.get('active') === 'true'

    let query = supabase.from('point_campaigns').select('*').order('starts_on', { ascending: false })
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error } = await query
    if (error) {
      console.error('[campaigns] list failed:', error)
      return NextResponse.json({ error: 'ดึงรายการแคมเปญไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json((data ?? []).map((c) => ({ ...c, multiplier: Number(c.multiplier) })))
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'ดึงรายการแคมเปญไม่สำเร็จ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE)
    const supabase = createServerSupabaseClient()
    const body = await request.json().catch(() => ({}))

    const parsed = validateCampaignFields(body)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const v = parsed.value
    // validateCampaignFields(partial=false) รับประกันว่า 4 ตัวนี้มีค่า
    const name = v.name as string
    const multiplier = v.multiplier as number
    const starts_on = v.starts_on as string
    const ends_on = v.ends_on as string
    const is_active = v.is_active ?? true

    if (is_active) {
      const conflict = await findConflict(supabase, starts_on, ends_on)
      if (conflict) return NextResponse.json({ error: overlapMessage(conflict), conflict }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('point_campaigns')
      .insert({
        name,
        description: v.description ?? null,
        multiplier,
        starts_on,
        ends_on,
        is_active,
        created_by: admin.id,
      })
      .select()
      .single()

    if (error) {
      // 23P01 = ชน EXCLUDE point_campaigns_no_overlap (race หลัง pre-check)
      if (error.code === '23P01') {
        const conflict = await findConflict(supabase, starts_on, ends_on)
        return NextResponse.json(
          {
            error: conflict ? overlapMessage(conflict) : 'ช่วงวันที่ทับกับแคมเปญที่เปิดใช้งานอยู่',
            conflict,
          },
          { status: 409 }
        )
      }
      console.error('[campaigns] insert failed:', error)
      return NextResponse.json({ error: 'สร้างแคมเปญไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json({ ...data, multiplier: Number(data.multiplier) }, { status: 201 })
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'สร้างแคมเปญไม่สำเร็จ' }, { status: 500 })
  }
}
