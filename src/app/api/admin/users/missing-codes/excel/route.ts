/**
 * GET /api/admin/users/missing-codes/excel — ลูกค้าที่ยังไม่มีรหัส เป็นไฟล์ตั้งต้นให้ผู้จัดการกรอกรหัส (ประชุม 2026-10-21)
 *
 * ลูกค้าสมัครผ่าน LINE ไม่รู้รหัสของตัวเองในระบบเปิดบิล → ผู้จัดการดาวน์โหลดไฟล์นี้ กรอกคอลัมน์ A
 * จากระบบเปิดบิล (ให้ตรงกับ SCG) แล้วอัปโหลดกลับที่ /admin/customer-codes — รูปแบบเดียวกับที่
 * POST /api/admin/users/import-codes อ่าน: A = รหัสลูกค้า · B = เบอร์โทร (ตัวจับคู่) · คอลัมน์อื่นไม่ถูกอ่าน
 *
 * เบอร์เป็นข้อความ xxx-xxxxxxx — import ตัดขีดเองด้วย normalizeThaiPhone · users.edit
 */
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { formatThaiPhone } from '@/lib/phone'
import { todayBangkok } from '@/lib/bangkok-date'
import { thaiDate, XLSX_MIME } from '@/lib/excel/build-reports'

export const runtime = 'nodejs'

const PAGE = 1000 // PostgREST ตัดที่ 1,000 แถวต่อ query

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.USERS_EDIT)
    const supabase = createServerSupabaseClient()

    const customers: { phone: string | null; first_name: string | null; last_name: string | null; created_at: string }[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('phone, first_name, last_name, created_at')
        .not('role', 'is', null)
        .is('customer_code', null)
        .not('phone', 'is', null)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[users/missing-codes/excel] query failed:', error)
        return NextResponse.json({ error: 'ดึงรายชื่อลูกค้าไม่สำเร็จ' }, { status: 500 })
      }
      customers.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'HugHome CRM'
    const ws = wb.addWorksheet('กรอกรหัสลูกค้า')
    ws.columns = [
      { header: 'รหัสลูกค้า (กรอก)', key: 'code', width: 20 },
      { header: 'เบอร์โทร', key: 'phone', width: 15 },
      { header: 'ชื่อ-นามสกุล', key: 'name', width: 28 },
      { header: 'วันที่สมัคร', key: 'created_at', width: 13 },
    ]
    ws.getColumn('code').numFmt = '@'
    ws.getColumn('phone').numFmt = '@'
    for (const c of customers) {
      ws.addRow({
        code: '',
        phone: formatThaiPhone(c.phone),
        name: [c.first_name, c.last_name].filter(Boolean).join(' '),
        created_at: thaiDate(c.created_at),
      })
    }
    const header = ws.getRow(1)
    header.font = { bold: true }
    for (let i = 1; i <= 4; i++) {
      header.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i === 1 ? 'FFFFF2CC' : 'FFEFEFEF' } }
    }
    ws.views = [{ state: 'frozen', ySplit: 1 }]

    const guide = wb.addWorksheet('วิธีใช้')
    ;[
      ['ผูกรหัสลูกค้าจากระบบเปิดบิล'],
      ['1. กรอกคอลัมน์ A ด้วยรหัสลูกค้าในระบบเปิดบิล (ให้ตรงกับ SCG) — แถวที่ยังไม่รู้รหัส เว้นว่างไว้ได้'],
      ['2. ห้ามแก้คอลัมน์ B (เบอร์โทร) — ระบบใช้เบอร์จับคู่ลูกค้า'],
      ['3. อัปโหลดไฟล์นี้ที่หน้า "นำเข้ารหัสลูกค้า" → ตรวจไฟล์ → บันทึก'],
      ['แถวที่เว้นรหัสว่างจะขึ้นเป็น "ผิดพลาด · ไม่ได้กรอกรหัสลูกค้า" และไม่ถูกบันทึก — ไม่กระทบแถวอื่น'],
      [`ลูกค้าที่ยังไม่มีรหัส ${customers.length} คน · ออกไฟล์เมื่อ ${thaiDate(new Date().toISOString())}`],
    ].forEach((r) => guide.addRow(r))
    guide.getColumn(1).width = 100
    guide.getRow(1).font = { bold: true, size: 13 }

    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="customers_missing_code_${todayBangkok()}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[users/missing-codes/excel] unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'สร้างไฟล์ไม่สำเร็จ' }, { status: 500 })
  }
}
