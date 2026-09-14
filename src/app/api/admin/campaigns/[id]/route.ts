/**
 * GET    /api/admin/campaigns/:id — รายละเอียด + จำนวนแถว ledger ที่อ้างถึง (campaigns.view)
 * PATCH  /api/admin/campaigns/:id — แก้ไข / เปิด-ปิดใช้งาน (campaigns.manage)
 * DELETE /api/admin/campaigns/:id — ลบถาวร เฉพาะแคมเปญที่ยังไม่มีแต้มอ้างถึง (campaigns.manage)
 *
 * "ปิดแคมเปญ" = is_active: false (soft delete) — EXCLUDE นับเฉพาะที่ active จึงปล่อยช่วงคืนให้ตัวใหม่
 * ลบถาวรถูก FK point_batch_ledger.campaign_id ON DELETE RESTRICT กันไว้ (23503) → แปลเป็นไทยที่นี่
 *
 * ⚠️ แก้ตัวคูณ/ช่วงวันของแคมเปญที่มีแต้มอ้างอยู่แล้ว ไม่กระทบแต้มที่ให้ไปแล้ว (ledger เก็บ multiplier
 *    ต่อแถว) แต่ batch ที่ preview ค้างไว้จะ commit ไม่ผ่าน — RPC ตรวจซ้ำแล้ว RAISE ให้ preview ใหม่
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { overlapMessage, validateCampaignFields } from '@/lib/campaigns'
import { campaignAuthError as authError, findConflict } from '@/lib/campaigns-server'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    await requirePermission(PERMISSIONS.CAMPAIGNS_VIEW)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const [campaignRes, ledgerRes] = await Promise.all([
      supabase.from('point_campaigns').select('*').eq('id', id).maybeSingle(),
      supabase.from('point_batch_ledger').select('id', { count: 'exact', head: true }).eq('campaign_id', id),
    ])

    if (campaignRes.error) {
      console.error('[campaigns] get failed:', campaignRes.error)
      return NextResponse.json({ error: 'ดึงข้อมูลแคมเปญไม่สำเร็จ' }, { status: 500 })
    }
    if (!campaignRes.data) return NextResponse.json({ error: 'ไม่พบแคมเปญนี้' }, { status: 404 })

    return NextResponse.json({
      ...campaignRes.data,
      multiplier: Number(campaignRes.data.multiplier),
      ledger_rows: ledgerRes.count ?? 0,
    })
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'ดึงข้อมูลแคมเปญไม่สำเร็จ' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE)
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const body = await request.json().catch(() => ({}))

    const parsed = validateCampaignFields(body, true)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    const v = parsed.value
    if (Object.keys(v).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' }, { status: 400 })
    }

    const { data: current, error: curErr } = await supabase
      .from('point_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (curErr) {
      console.error('[campaigns] load before update failed:', curErr)
      return NextResponse.json({ error: 'แก้ไขแคมเปญไม่สำเร็จ' }, { status: 500 })
    }
    if (!current) return NextResponse.json({ error: 'ไม่พบแคมเปญนี้' }, { status: 404 })

    // ค่าหลังแก้ (ใช้เช็คช่วงและ ends >= starts ข้ามฟิลด์ที่ส่งมาแค่ตัวเดียว)
    const starts_on = v.starts_on ?? current.starts_on
    const ends_on = v.ends_on ?? current.ends_on
    const is_active = v.is_active ?? current.is_active
    if (ends_on < starts_on) {
      return NextResponse.json({ error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' }, { status: 400 })
    }

    if (is_active) {
      const conflict = await findConflict(supabase, starts_on, ends_on, id)
      if (conflict) return NextResponse.json({ error: overlapMessage(conflict), conflict }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('point_campaigns')
      .update({ ...v, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23P01') {
        const conflict = await findConflict(supabase, starts_on, ends_on, id)
        return NextResponse.json(
          {
            error: conflict ? overlapMessage(conflict) : 'ช่วงวันที่ทับกับแคมเปญที่เปิดใช้งานอยู่',
            conflict,
          },
          { status: 409 }
        )
      }
      console.error('[campaigns] update failed:', error)
      return NextResponse.json({ error: 'แก้ไขแคมเปญไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json({ ...data, multiplier: Number(data.multiplier) })
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'แก้ไขแคมเปญไม่สำเร็จ' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    await requirePermission(PERMISSIONS.CAMPAIGNS_MANAGE)
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from('point_campaigns').delete().eq('id', id).select('id').maybeSingle()

    if (error) {
      // 23503 = FK point_batch_ledger.campaign_id ON DELETE RESTRICT — มีแต้มที่ให้ไปแล้วอ้างถึง
      if (error.code === '23503') {
        const { count } = await supabase
          .from('point_batch_ledger')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', id)
        return NextResponse.json(
          {
            error: `ลบไม่ได้ — มีแต้มที่ให้ไปแล้ว ${count ?? 'หลาย'} รายการอ้างถึงแคมเปญนี้ (ต้องสาวกลับได้ว่าตัวคูณมาจากไหน) ให้ปิดใช้งานแทน`,
            ledger_rows: count ?? null,
          },
          { status: 409 }
        )
      }
      console.error('[campaigns] delete failed:', error)
      return NextResponse.json({ error: 'ลบแคมเปญไม่สำเร็จ' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'ไม่พบแคมเปญนี้' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return authError(error) ?? NextResponse.json({ error: 'ลบแคมเปญไม่สำเร็จ' }, { status: 500 })
  }
}
