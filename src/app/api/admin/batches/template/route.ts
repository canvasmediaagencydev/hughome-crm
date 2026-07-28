/**
 * GET /api/admin/batches/template — ดาวน์โหลด Excel template สำหรับพนักงานขาย
 *
 * ⚠️ generate สดทุกครั้ง ห้าม serve ไฟล์ static ใน docs/
 *    dropdown ต้องเป็นรายชื่อ sales_reps ที่ is_active=true "ณ ตอนนี้"
 *    ไม่งั้นพนักงานที่ลาออกแล้วยังถูกคีย์ต่อได้ และคนใหม่จะไม่มีชื่อให้เลือก
 */
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { PERMISSIONS } from '@/types/admin'
import { buildSalesTemplate } from '@/lib/excel/build-template'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.BATCHES_VIEW)
    const supabase = createServerSupabaseClient()

    const { data: reps, error } = await supabase
      .from('sales_reps')
      .select('code, full_name')
      .eq('is_active', true)
      .order('code')

    if (error) {
      console.error('[batches/template] lookup failed:', error)
      return NextResponse.json({ error: 'ดึงรายชื่อพนักงานขายไม่สำเร็จ' }, { status: 500 })
    }
    if (!reps || reps.length === 0) {
      return NextResponse.json(
        { error: 'ยังไม่มีพนักงานขายที่เปิดใช้งาน — เพิ่มรายชื่อที่หน้า "พนักงานขาย" ก่อนดาวน์โหลด template' },
        { status: 409 }
      )
    }

    const wb = buildSalesTemplate(reps)
    const buffer = await wb.xlsx.writeBuffer()

    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Hughome_Sales_Template_${stamp}.xlsx"`,
        'Cache-Control': 'no-store', // รายชื่อพนักงานเปลี่ยนได้ตลอด ห้าม cache
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.startsWith('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (message.startsWith('Forbidden')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    console.error('[batches/template] unexpected:', error)
    return NextResponse.json({ error: 'สร้าง template ไม่สำเร็จ' }, { status: 500 })
  }
}
