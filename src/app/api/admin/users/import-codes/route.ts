/**
 * POST /api/admin/users/import-codes — นำเข้ารหัสลูกค้าจากระบบเดิม (Q1 · 2026-09-21)
 *
 * multipart: file (.xlsx · แผ่นแรก · แถว 1 หัวตาราง · คอลัมน์ A = รหัสลูกค้า, B = เบอร์โทร)
 *            apply = "1" เพื่อเขียนจริง · ไม่ส่ง = dry-run (preview อย่างเดียว)
 *            overwrite = "1" ยอมทับรหัสเดิมที่ต่างกัน (ค่าเริ่มต้น: ข้ามแถวนั้น รายงานเป็น conflict)
 *
 * จับคู่ด้วย "เบอร์โทร" (normalize เหมือน parser ยอดขาย) — เบอร์เป็น identity เสมอ ไม่สร้างลูกค้าใหม่
 * เขียนเฉพาะ user_profiles.customer_code · ไม่แตะแต้ม · users.edit
 */
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { normalizeThaiPhone } from '@/lib/phone'
import { normalizeCustomerCode, isValidCustomerCode, CUSTOMER_CODE_FORMAT_HINT } from '@/lib/customer-code'

export const runtime = 'nodejs'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_ROWS = 5000

type RowStatus = 'will_set' | 'already_same' | 'conflict' | 'unmatched' | 'invalid' | 'duplicate_in_file'

interface ImportRow {
  row_no: number
  code: string | null
  phone_raw: string | null
  phone: string | null
  user_id: string | null
  user_name: string | null
  current_code: string | null
  status: RowStatus
  message: string
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return String(Math.trunc(v))
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join('').trim()
    if (typeof o.text === 'string') return o.text.trim()
    if ('result' in o) return String(o.result ?? '').trim()
    return ''
  }
  return String(v).trim()
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(PERMISSIONS.USERS_EDIT)
    const supabase = createServerSupabaseClient()

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'ต้องส่งเป็น multipart/form-data' }, { status: 400 })
    }
    const apply = String(form.get('apply') ?? '') === '1'
    const overwrite = String(form.get('overwrite') ?? '') === '1'
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'ไม่พบไฟล์ (field ชื่อ "file")' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.xlsx')) return NextResponse.json({ error: 'รับเฉพาะ .xlsx' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'ไฟล์ใหญ่เกิน 2 MB' }, { status: 413 })

    const wb = new ExcelJS.Workbook()
    try {
      await wb.xlsx.load((await file.arrayBuffer()) as unknown as ArrayBuffer)
    } catch {
      return NextResponse.json({ error: 'เปิดไฟล์ไม่ได้ — ต้องเป็น .xlsx ที่ไม่เสียหาย' }, { status: 422 })
    }
    const ws = wb.worksheets[0]
    if (!ws) return NextResponse.json({ error: 'ไฟล์ไม่มีแผ่นงาน' }, { status: 422 })

    // ---------- อ่านแถว (ข้ามหัวตารางแถว 1) ----------
    const raw: { row_no: number; code: string | null; phone_raw: string }[] = []
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const code = normalizeCustomerCode(cellText(row.getCell(1).value))
      const phone_raw = cellText(row.getCell(2).value)
      if (!code && !phone_raw) continue
      raw.push({ row_no: r, code, phone_raw })
      if (raw.length > MAX_ROWS) return NextResponse.json({ error: `เกิน ${MAX_ROWS} แถว — แบ่งไฟล์` }, { status: 422 })
    }
    if (raw.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูล (แถว 1 = หัวตาราง · A = รหัส · B = เบอร์)' }, { status: 422 })

    // ---------- lookup ลูกค้าด้วยเบอร์ ----------
    const phones = [...new Set(raw.map((x) => normalizeThaiPhone(x.phone_raw)).filter((p): p is string => !!p))]
    const userByPhone = new Map<string, { id: string; name: string; customer_code: string | null }>()
    for (let i = 0; i < phones.length; i += 200) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, phone, first_name, last_name, display_name, customer_code')
        .in('phone', phones.slice(i, i + 200))
      if (error) {
        console.error('[users/import-codes] lookup failed:', error)
        return NextResponse.json({ error: 'ค้นหาลูกค้าไม่สำเร็จ' }, { status: 500 })
      }
      for (const u of data ?? []) {
        if (!u.phone) continue
        userByPhone.set(u.phone, {
          id: u.id,
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.display_name || '',
          customer_code: u.customer_code ?? null,
        })
      }
    }

    // รหัสที่ถูกใช้โดยลูกค้าคนอื่นอยู่แล้ว (รหัสหนึ่งต้องชี้คนเดียว)
    const codes = [...new Set(raw.map((x) => x.code).filter((c): c is string => !!c))]
    const ownerByCode = new Map<string, string>()
    for (let i = 0; i < codes.length; i += 200) {
      const { data, error } = await supabase.from('user_profiles').select('id, customer_code').in('customer_code', codes.slice(i, i + 200))
      if (error) {
        console.error('[users/import-codes] code lookup failed:', error)
        return NextResponse.json({ error: 'ตรวจรหัสซ้ำไม่สำเร็จ' }, { status: 500 })
      }
      for (const u of data ?? []) if (u.customer_code) ownerByCode.set(u.customer_code, u.id)
    }

    // ---------- ตัดสินรายแถว ----------
    const seenCode = new Map<string, number>()
    const seenPhone = new Map<string, number>()
    const rows: ImportRow[] = raw.map((x) => {
      const phone = normalizeThaiPhone(x.phone_raw)
      const base = { row_no: x.row_no, code: x.code, phone_raw: x.phone_raw || null, phone, user_id: null, user_name: null, current_code: null }
      if (!x.code) return { ...base, status: 'invalid', message: 'ไม่ได้กรอกรหัสลูกค้า' }
      if (!isValidCustomerCode(x.code)) return { ...base, status: 'invalid', message: `รหัสไม่ถูกรูปแบบ — ${CUSTOMER_CODE_FORMAT_HINT}` }
      if (!phone) return { ...base, status: 'invalid', message: `เบอร์ไม่ถูกต้อง: "${x.phone_raw}"` }
      const dupC = seenCode.get(x.code)
      if (dupC) return { ...base, status: 'duplicate_in_file', message: `รหัสซ้ำกับแถว ${dupC}` }
      const dupP = seenPhone.get(phone)
      if (dupP) return { ...base, status: 'duplicate_in_file', message: `เบอร์ซ้ำกับแถว ${dupP}` }
      seenCode.set(x.code, x.row_no)
      seenPhone.set(phone, x.row_no)

      const u = userByPhone.get(phone)
      if (!u) return { ...base, status: 'unmatched', message: 'ไม่พบลูกค้าเบอร์นี้ในระบบ (ยังไม่สมัครผ่าน LINE)' }
      const filled = { ...base, user_id: u.id, user_name: u.name, current_code: u.customer_code }
      const owner = ownerByCode.get(x.code)
      if (owner && owner !== u.id) return { ...filled, status: 'conflict', message: 'รหัสนี้ถูกใช้โดยลูกค้าคนอื่นแล้ว' }
      if (u.customer_code === x.code) return { ...filled, status: 'already_same', message: 'รหัสตรงอยู่แล้ว' }
      if (u.customer_code && u.customer_code !== x.code && !overwrite) {
        return { ...filled, status: 'conflict', message: `ลูกค้ามีรหัส "${u.customer_code}" อยู่แล้ว — ติ๊ก "ทับรหัสเดิม" ถ้าต้องการเปลี่ยน` }
      }
      return { ...filled, status: 'will_set', message: u.customer_code ? `เปลี่ยนจาก "${u.customer_code}"` : 'จะตั้งรหัสให้' }
    })

    const summary = {
      total: rows.length,
      will_set: rows.filter((r) => r.status === 'will_set').length,
      already_same: rows.filter((r) => r.status === 'already_same').length,
      conflict: rows.filter((r) => r.status === 'conflict').length,
      unmatched: rows.filter((r) => r.status === 'unmatched').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicate_in_file: rows.filter((r) => r.status === 'duplicate_in_file').length,
      applied: 0,
    }

    // ---------- เขียนจริง (เฉพาะ will_set · ทีละแถว กัน unique ชนแล้วล้มทั้งชุดแบบเงียบ) ----------
    if (apply) {
      for (const r of rows) {
        if (r.status !== 'will_set' || !r.user_id || !r.code) continue
        const { error } = await supabase.from('user_profiles').update({ customer_code: r.code }).eq('id', r.user_id)
        if (error) {
          r.status = 'conflict'
          r.message = `บันทึกไม่สำเร็จ: ${error.message}`
          summary.will_set--
          summary.conflict++
          continue
        }
        summary.applied++
      }
    }

    return NextResponse.json({ applied: apply, overwrite, file_name: file.name, summary, rows })
  } catch (error) {
    console.error('[users/import-codes] unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'นำเข้ารหัสไม่สำเร็จ' }, { status: 500 })
  }
}
