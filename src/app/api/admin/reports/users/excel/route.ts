/**
 * GET /api/admin/reports/users/excel?start=YYYY-MM-DD&end=YYYY-MM-DD[&role=contractor|homeowner]
 * รายงานลูกค้าสำหรับการตลาด (Sprint 9R A5 · wiki/14 §3 "Reports")
 *
 *   1 แถว = ลูกค้า 1 คน · ทุกคนที่ onboard แล้ว (role ไม่ว่าง) — ช่วงวันที่ใช้คำนวณ
 *   "ยอดซื้อสุทธิรวมในช่วง" และ "จำนวนบิลในช่วง" จาก ledger (ตามวันที่ซื้อ · ไม่นับชุดที่ถูก void)
 *   ห้ามมีคอลัมน์เลขที่บิล — รายงานตรวจบิลคือ /api/admin/reports/batches/:id/excel
 *   เบอร์ 10 หลักติดกัน ไม่มีขีด · คอลัมน์เป็น text กัน Excel ตัด 0
 *
 * ตัวสร้างไฟล์อยู่ที่ src/lib/excel/build-reports.js (ใช้ร่วมกับ scripts/build-sample-reports.js)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { todayBangkok, isIsoDate } from '@/lib/bangkok-date'
import { buildCustomerExport, customerExportFilename, XLSX_MIME } from '@/lib/excel/build-reports'

export const runtime = 'nodejs'

const PAGE = 1000 // PostgREST ตัดที่ 1,000 แถวต่อ query — ต้องวนดึงเอง

interface CustomerRow {
  id: string
  customer_code: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  role: string | null
  created_at: string
  points_balance: number | null
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_VIEW)
    const supabase = createServerSupabaseClient()
    const sp = new URL(request.url).searchParams

    const start = sp.get('start')
    const end = sp.get('end')
    const role = sp.get('role')
    if (!isIsoDate(start) || !isIsoDate(end)) {
      return NextResponse.json({ error: 'ต้องระบุ start และ end เป็น YYYY-MM-DD' }, { status: 400 })
    }
    if (end < start) return NextResponse.json({ error: 'end ต้องไม่มาก่อน start' }, { status: 400 })
    if (role && role !== 'contractor' && role !== 'homeowner') {
      return NextResponse.json({ error: "role ต้องเป็น 'contractor' หรือ 'homeowner'" }, { status: 400 })
    }

    // ---------- ลูกค้าทั้งหมด (วนหน้า) ----------
    const customers: CustomerRow[] = []
    for (let from = 0; ; from += PAGE) {
      let q = supabase
        .from('user_profiles')
        .select('id, customer_code, first_name, last_name, phone, role, created_at, points_balance')
        .not('role', 'is', null)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (role) q = q.eq('role', role)
      const { data, error } = await q
      if (error) {
        console.error('[reports/users/excel] customers failed:', error)
        return NextResponse.json({ error: 'ดึงรายชื่อลูกค้าไม่สำเร็จ' }, { status: 500 })
      }
      customers.push(...((data ?? []) as CustomerRow[]))
      if (!data || data.length < PAGE) break
    }
    const ids = new Set(customers.map((c) => c.id))

    // ---------- ยอดซื้อ/จำนวนบิลในช่วง (ledger ตามวันที่ซื้อ · ไม่นับ void) ----------
    const netByUser = new Map<string, { net: number; bills: number }>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('point_batch_ledger')
        .select('user_id, net_amount')
        .eq('voided', false)
        .gte('purchase_date', start)
        .lte('purchase_date', end)
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[reports/users/excel] ledger range failed:', error)
        return NextResponse.json({ error: 'ดึงยอดซื้อในช่วงไม่สำเร็จ' }, { status: 500 })
      }
      for (const l of data ?? []) {
        if (!ids.has(l.user_id)) continue
        const cur = netByUser.get(l.user_id) ?? { net: 0, bills: 0 }
        cur.net += Number(l.net_amount ?? 0)
        cur.bills += 1
        netByUser.set(l.user_id, cur)
      }
      if (!data || data.length < PAGE) break
    }

    // ---------- แต้มก้อนถัดไปที่จะหมดอายุ (เรียงตาม expires_at → แถวแรกของแต่ละคนคือก้อนถัดไป) ----------
    const nextByUser = new Map<string, { points: number; date: string }>()
    const today = todayBangkok()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('point_batch_ledger')
        .select('user_id, points_remaining, expires_at')
        .gt('points_remaining', 0)
        .gte('expires_at', today)
        .order('expires_at', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[reports/users/excel] ledger expiry failed:', error)
        return NextResponse.json({ error: 'ดึงแต้มที่จะหมดอายุไม่สำเร็จ' }, { status: 500 })
      }
      for (const l of data ?? []) {
        if (!ids.has(l.user_id)) continue
        const cur = nextByUser.get(l.user_id)
        if (!cur) nextByUser.set(l.user_id, { points: l.points_remaining, date: l.expires_at })
        else if (cur.date === l.expires_at) cur.points += l.points_remaining // หลาย lot หมดวันเดียวกัน → รวม
      }
      if (!data || data.length < PAGE) break
    }

    // ---------- แท็ก ----------
    const tagsByUser = new Map<string, string[]>()
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('user_tags')
        .select('user_id, tags ( name )')
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[reports/users/excel] tags failed:', error)
        return NextResponse.json({ error: 'ดึงแท็กไม่สำเร็จ' }, { status: 500 })
      }
      for (const t of data ?? []) {
        const name = (t.tags as unknown as { name: string } | null)?.name
        if (!name || !ids.has(t.user_id)) continue
        const arr = tagsByUser.get(t.user_id) ?? []
        arr.push(name)
        tagsByUser.set(t.user_id, arr)
      }
      if (!data || data.length < PAGE) break
    }

    const wb = buildCustomerExport({
      rangeStart: start,
      rangeEnd: end,
      customers: customers.map((c) => {
        const inRange = netByUser.get(c.id)
        const next = nextByUser.get(c.id)
        return {
          customer_code: c.customer_code,
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone,
          role: c.role,
          created_at: c.created_at,
          points_balance: c.points_balance ?? 0,
          next_expiry_points: next?.points ?? null,
          next_expiry_date: next?.date ?? null,
          net_in_range: inRange?.net ?? 0,
          bills_in_range: inRange?.bills ?? 0,
          tags: (tagsByUser.get(c.id) ?? []).sort(),
        }
      }),
    })
    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${customerExportFilename(start, end)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[reports/users/excel] unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'สร้างไฟล์รายงานไม่สำเร็จ' }, { status: 500 })
  }
}
