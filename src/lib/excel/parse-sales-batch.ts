/**
 * Parser ของไฟล์ยอดขายรายสัปดาห์ (Sprint 4) — MIGRATION_PLAN.md §6.2, §9.3, §9.7, §12
 *
 * แยกจาก API route โดยตั้งใจ: ตรรกะทั้งหมดเป็น pure function รับ Buffer + lookup ที่ route
 * ดึงมาให้ → ทดสอบได้โดยไม่ต้องมี DB/session (ดู scripts/test-parse-sales-batch.js)
 *
 * ⚠️ หัวตารางและ limit อ่านจาก sales-columns.json เท่านั้น ห้าม hardcode ชื่อคอลัมน์ที่นี่
 */
import ExcelJS from 'exceljs'
import { normalizeThaiPhone } from '@/lib/phone'
import SPEC from './sales-columns.json'

/**
 * valid            — ให้แต้มตอนอนุมัติ
 * duplicate_amount — ให้แต้มเหมือน valid แต่เตือน: เบอร์ + วันที่ซื้อ + ยอดสุทธิ ซ้ำกับแถวก่อนหน้าในไฟล์
 *                    (Sprint 9R A4 · Q2 ยังไม่ตอบ จึงเป็น warning ไม่ใช่ reject — สลับได้ด้วย duplicateAmountPolicy)
 * unmatched        — เบอร์ถูกต้องแต่ไม่มีลูกค้า
 * invalid          — อย่างอื่นทั้งหมด
 */
export type RowStatus = 'valid' | 'duplicate_amount' | 'invalid' | 'unmatched'

/** สถานะที่ RPC award_points_from_batch ให้แต้ม (ต้องตรงกับ migration 024/025) */
export const AWARDABLE_STATUSES: readonly RowStatus[] = ['valid', 'duplicate_amount']
export const isAwardable = (s: RowStatus) => AWARDABLE_STATUSES.includes(s)

export interface SalesRepLookup {
  id: string
  code: string
  full_name: string
  is_active: boolean
}

export interface CampaignLookup {
  id: string
  name: string
  multiplier: number
  starts_on: string // YYYY-MM-DD inclusive
  ends_on: string // YYYY-MM-DD inclusive
}

export interface ParseContext {
  weekStart: string // YYYY-MM-DD
  weekEnd: string // YYYY-MM-DD
  bahtPerPoint: number
  salesReps: SalesRepLookup[]
  /** เฉพาะ campaign ที่ is_active — DB กันช่วงซ้อนไว้แล้ว จึงคลุมได้ไม่เกิน 1 ตัวต่อวัน */
  activeCampaigns: CampaignLookup[]
  /** เบอร์ (normalize แล้ว) → user_profiles.id */
  usersByPhone: Map<string, string>
  /**
   * user_profiles.id → customer_code (null = ลูกค้ายังไม่มีรหัส)
   * ใช้ cross-check คอลัมน์ รหัสลูกค้า กับเบอร์ (เบอร์เป็น key เสมอ · รหัสไม่ตรง = warning ไม่ใช่ reject)
   * ไม่ส่งมา = ข้ามการ cross-check (สคริปต์เก่า/บาง e2e)
   */
  customerCodeByUserId?: Map<string, string | null>
  /** upper(trim(bill_no)) ของ ledger ที่ voided=false → batch id ที่ใช้ไปแล้ว */
  billsInUse: Map<string, string>
  /**
   * เบอร์ + วันที่ซื้อ + ยอดสุทธิ ซ้ำกันในไฟล์เดียวกัน:
   *   'warn'   (ค่าเริ่มต้น) → status duplicate_amount ให้แต้มได้ แต่ preview นับและโชว์
   *   'reject' → status invalid
   * เปลี่ยนเป็น 'reject' ได้ที่จุดเดียวถ้า Q2 ตอบว่าต้อง reject
   */
  duplicateAmountPolicy?: 'warn' | 'reject'
}

export interface ParsedRow {
  row_no: number
  customer_code: string | null
  purchase_date: string | null
  bill_no: string | null
  phone: string | null
  phone_raw: string | null
  customer_name: string | null
  gross: number | null
  discount: number
  net: number | null
  sales_rep_code: string | null
  sales_rep_id: string | null
  sales_rep_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  multiplier: number
  points: number | null
  user_id: string | null
  note: string | null
  status: RowStatus
  errors: string[]
  /** เตือนแต่ไม่กันแต้ม: รหัสลูกค้าไม่ตรง · ยอดซ้ำในไฟล์ (ผู้อนุมัติต้องเห็น) */
  warnings: string[]
  /** แถวก่อนหน้าในไฟล์ที่ เบอร์+วันที่+สุทธิ ซ้ำกัน (เฉพาะ duplicate_amount / reject จากนโยบาย) */
  duplicate_of_row: number | null
}

export interface ParseResult {
  rows: ParsedRow[]
  summary: {
    total: number
    /** status = 'valid' เท่านั้น (ไม่รวม duplicate_amount) */
    valid: number
    /** ยอดซ้ำในไฟล์ — ให้แต้มได้ แต่ผู้อนุมัติต้องเห็นตัวเลขนี้ */
    duplicate_amount: number
    invalid: number
    unmatched: number
    /** แถวที่มี warning อย่างน้อย 1 ข้อ (รวม duplicate_amount และรหัสลูกค้าไม่ตรง) */
    warned: number
    blank_skipped: number
    /** ผลรวมแต้มของแถวที่จะได้แต้มตอนอนุมัติ (valid + duplicate_amount) */
    total_points: number
  }
}

/** ไฟล์ใช้ไม่ได้ทั้งไฟล์ (หัวตารางผิด / sheet แปลกปลอม / เกิน limit / มีสูตร) */
export class BatchFileError extends Error {
  readonly details: string[]
  constructor(message: string, details: string[] = []) {
    super(message)
    this.name = 'BatchFileError'
    this.details = details
  }
}

const COLS = SPEC.columns
const HEADER_ROW = SPEC.headerRow
const SEP = SPEC.salesRepSeparator
const ALLOWED_SHEETS = new Set([SPEC.sheetName, SPEC.guideSheetName, SPEC.staffSheetName])
const colIndex = (key: string) => COLS.findIndex((c) => c.key === key) + 1 // exceljs = 1-based

// ---------------------------------------------------------------------------
// cell helpers
// ---------------------------------------------------------------------------

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const o = v as unknown as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((r) => r.text).join('').trim()
    }
    if (typeof o.text === 'string') return o.text.trim()
    if ('result' in o) return String(o.result ?? '').trim()
    if ('error' in o) return ''
  }
  return String(v).trim()
}

/** ยอดเงิน: ยอมให้มีคอมม่า/ช่องว่าง/คำว่า "บาท" ที่คนชอบพิมพ์ติดมา */
function parseAmount(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw
    .replace(/[,\s]/g, '')
    .replace(/บาท|฿|THB/gi, '')
    .trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** ปี พ.ศ. → ค.ศ. · ใช้ 2400 เป็นเส้นแบ่ง (ค.ศ. จริงไม่มีทางถึง) */
const toCE = (year: number) => (year > 2400 ? year - 543 : year)

function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * วันที่ซื้อ — รับ 3 รูปแบบที่เจอจริง:
 *   1. เซลล์วันที่จริง (exceljs คืน Date เป็น UTC)
 *   2. Excel serial number (เซลล์ที่ format หลุด)
 *   3. ข้อความ dd/mm/yyyy · dd-mm-yyyy · yyyy-mm-dd
 * ปี พ.ศ. แปลงให้อัตโนมัติ · ปี 2 หลักไม่เดาให้ (เดาผิด = แต้มหมดอายุผิดปี)
 */
export function parsePurchaseDate(cell: ExcelJS.Cell): { date: string | null; error?: string } {
  const v = cell.value

  if (v instanceof Date) {
    return { date: ymd(toCE(v.getUTCFullYear()), v.getUTCMonth() + 1, v.getUTCDate()) }
  }

  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v <= 0 || v > 2958465) return { date: null, error: 'วันที่ไม่ถูกต้อง' }
    // Excel serial → วันที่ (epoch 1899-12-30 ชดเชยบั๊กปี 1900 ของ Excel)
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000)
    return { date: ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()) }
  }

  const text = cellText(cell)
  if (!text) return { date: null, error: 'ไม่ได้กรอกวันที่ซื้อ' }

  const dmy = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (dmy) {
    if (dmy[3].length < 4) {
      return { date: null, error: `ปีต้องเป็น 4 หลัก (ได้ "${text}") — 2 หลักเดาไม่ได้ว่า ค.ศ. หรือ พ.ศ.` }
    }
    const y = toCE(Number(dmy[3]))
    const m = Number(dmy[2])
    const d = Number(dmy[1])
    if (!isRealDate(y, m, d)) return { date: null, error: `วันที่ไม่มีจริง: "${text}"` }
    return { date: ymd(y, m, d) }
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const y = toCE(Number(iso[1]))
    const m = Number(iso[2])
    const d = Number(iso[3])
    if (!isRealDate(y, m, d)) return { date: null, error: `วันที่ไม่มีจริง: "${text}"` }
    return { date: ymd(y, m, d) }
  }

  return { date: null, error: `อ่านวันที่ไม่ออก: "${text}" (ใช้รูปแบบ dd/mm/yyyy)` }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export async function parseSalesBatch(buffer: Buffer, ctx: ParseContext): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
  } catch {
    throw new BatchFileError('เปิดไฟล์ไม่ได้ — ต้องเป็นไฟล์ .xlsx ที่ไม่เสียหาย')
  }

  // --- sheet: ห้าม trust ชื่อ sheet ที่เกินจากที่กำหนด (§9.3) ---
  const unexpected = wb.worksheets.map((w) => w.name).filter((n) => !ALLOWED_SHEETS.has(n))
  if (unexpected.length) {
    throw new BatchFileError(
      'ไฟล์มีแผ่นงานที่ไม่รู้จัก — ใช้ template จากระบบเท่านั้น',
      unexpected.map((n) => `แผ่นแปลกปลอม: "${n}"`)
    )
  }

  const ws = wb.getWorksheet(SPEC.sheetName)
  if (!ws) throw new BatchFileError(`ไม่พบแผ่นงานชื่อ "${SPEC.sheetName}"`)

  // --- หัวตาราง ---
  const headerRow = ws.getRow(HEADER_ROW)
  const headerProblems: string[] = []
  COLS.forEach((c, i) => {
    const got = cellText(headerRow.getCell(i + 1))
    if (got !== c.header) {
      headerProblems.push(`คอลัมน์ ${c.letter}: ต้องเป็น "${c.header}" แต่เจอ "${got || '(ว่าง)'}"`)
    }
  })
  const extra = cellText(headerRow.getCell(COLS.length + 1))
  if (extra) headerProblems.push(`คอลัมน์ ${String.fromCharCode(65 + COLS.length)}: มีคอลัมน์เกินมา "${extra}"`)
  if (headerProblems.length) {
    throw new BatchFileError('หัวตารางไม่ตรงกับ template — ห้ามแก้ชื่อ/สลับ/เพิ่ม/ลบคอลัมน์', headerProblems)
  }

  // --- เก็บแถวที่มีข้อมูลจริง + ตรวจสูตร ---
  // หมายเหตุ: ws.rowCount นับแถวที่มีแค่ style/data-validation ด้วย (template ใส่ validation
  // ไว้ถึงแถว 2001) → ต้องดูค่าจริงในเซลล์ ไม่ใช่เชื่อ rowCount
  const dataRowNos: number[] = []
  const formulaCells: string[] = []

  for (let r = HEADER_ROW + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    let hasValue = false
    for (let c = 1; c <= COLS.length; c++) {
      const cell = row.getCell(c)
      // cell.formula ครอบทั้ง formula ปกติและ shared formula · เช็ค type ซ้ำกันพลาด
      if (cell.formula || cell.type === ExcelJS.ValueType.Formula) {
        if (formulaCells.length < 10) formulaCells.push(cell.address)
      }
      if (cellText(cell) !== '') hasValue = true
    }
    if (!hasValue) continue
    dataRowNos.push(r)
    if (dataRowNos.length > SPEC.limits.maxDataRows) {
      throw new BatchFileError(
        `ไฟล์มีแถวข้อมูลเกินขีดจำกัด ${SPEC.limits.maxDataRows.toLocaleString('en-US')} แถว — แบ่งไฟล์ก่อนอัปโหลด`
      )
    }
  }

  if (formulaCells.length) {
    throw new BatchFileError(
      'ไฟล์มีเซลล์ที่เป็นสูตร — ต้องเป็นค่าคงที่เท่านั้น (คัดลอกแล้ววางแบบ "ค่า")',
      formulaCells.map((a) => `เซลล์สูตร: ${a}`)
    )
  }

  // แถวว่างที่ "คั่นกลาง" ระหว่างแถวข้อมูล (ท้ายไฟล์ไม่นับ) — ข้ามให้แต่รายงานไว้
  const blankSkipped = dataRowNos.length
    ? dataRowNos[dataRowNos.length - 1] - HEADER_ROW - dataRowNos.length
    : 0

  // --- lookup ---
  const repByCode = new Map<string, SalesRepLookup>()
  for (const r of ctx.salesReps) repByCode.set(r.code.trim().toUpperCase(), r)

  const findCampaign = (date: string) =>
    ctx.activeCampaigns.find((c) => date >= c.starts_on && date <= c.ends_on) ?? null

  const billSeenInFile = new Map<string, number>()
  /** `${phone}|${purchase_date}|${net}` → row_no แรกที่เจอ */
  const amountSeenInFile = new Map<string, number>()
  const dupPolicy = ctx.duplicateAmountPolicy ?? 'warn'

  const rows: ParsedRow[] = []

  for (const r of dataRowNos) {
    const row = ws.getRow(r)
    const errors: string[] = []
    const warnings: string[] = []
    let unmatchedOnly = false

    // ---- รหัสลูกค้า (คอลัมน์ A · v2) — อ่านไว้ก่อน cross-check หลังจับคู่เบอร์ ----
    const customerCode = cellText(row.getCell(colIndex('customer_code'))) || null

    // ---- วันที่ซื้อ ----
    const dateCell = row.getCell(colIndex('purchase_date'))
    const { date: purchaseDate, error: dateError } = parsePurchaseDate(dateCell)
    if (dateError) errors.push(dateError)
    else if (purchaseDate && (purchaseDate < ctx.weekStart || purchaseDate > ctx.weekEnd)) {
      errors.push(`วันที่ซื้อ ${purchaseDate} อยู่นอกช่วง ${ctx.weekStart} ถึง ${ctx.weekEnd} — แยกไฟล์ตามสัปดาห์`)
    }

    // ---- เลขที่บิล ----
    const billRaw = cellText(row.getCell(colIndex('bill_no')))
    let billNo: string | null = billRaw.trim() || null
    if (!billNo) {
      errors.push('ไม่ได้กรอกเลขที่บิล')
    } else if (billNo.length > 64) {
      errors.push(`เลขที่บิลยาวเกิน 64 ตัวอักษร (${billNo.length})`)
      billNo = null
      // eslint-disable-next-line no-control-regex
    } else if (/[\x00-\x1f\x7f]/.test(billNo)) {
      errors.push('เลขที่บิลมีอักขระควบคุมที่ใช้ไม่ได้')
      billNo = null
    } else {
      const norm = billNo.toUpperCase()
      const dupRow = billSeenInFile.get(norm)
      if (dupRow) errors.push(`เลขที่บิลซ้ำกับแถวที่ ${dupRow} ในไฟล์เดียวกัน`)
      else if (ctx.billsInUse.has(norm)) errors.push('เลขที่บิลนี้เคยได้แต้มไปแล้ว (อยู่ใน batch ที่ยังไม่ถูกยกเลิก)')
      else billSeenInFile.set(norm, r)
    }

    // ---- เบอร์โทร + จับคู่ลูกค้า ----
    const phoneRaw = cellText(row.getCell(colIndex('phone')))
    const phone = normalizeThaiPhone(phoneRaw)
    let userId: string | null = null
    if (!phoneRaw) {
      errors.push('ไม่ได้กรอกเบอร์โทรลูกค้า')
    } else if (!phone) {
      errors.push(`เบอร์โทรไม่ถูกต้อง: "${phoneRaw}" (ต้อง 10 หลักขึ้นต้น 06/08/09)`)
    } else {
      userId = ctx.usersByPhone.get(phone) ?? null
      if (!userId) {
        errors.push(`ไม่พบลูกค้าเบอร์ ${phone} ในระบบ — ให้ลูกค้าสมัครผ่าน LINE ก่อน`)
        unmatchedOnly = errors.length === 1
      } else if (ctx.customerCodeByUserId) {
        // cross-check รหัสลูกค้า ↔ เบอร์ · เบอร์เป็น key เสมอ (กันบัญชีผีจากรหัสพิมพ์ผิด)
        // ทั้งสองฝั่งว่าง = ยังไม่มีอะไรให้เทียบ (Q1 ยังไม่ตอบ ลูกค้าใหม่ไม่มีรหัส) → ไม่เตือน
        const dbCode = ctx.customerCodeByUserId.get(userId) ?? null
        const norm = (c: string | null) => (c ?? '').trim().toUpperCase()
        if (customerCode && !dbCode) {
          warnings.push(`ระบบยังไม่มีรหัสของลูกค้าเบอร์นี้ (ไฟล์ระบุ "${customerCode}")`)
        } else if (!customerCode && dbCode) {
          warnings.push(`ไม่ได้กรอกรหัสลูกค้า (ระบบ: ${dbCode})`)
        } else if (customerCode && dbCode && norm(customerCode) !== norm(dbCode)) {
          warnings.push(`รหัสลูกค้าไม่ตรงกับระบบ (ไฟล์ "${customerCode}" · ระบบ "${dbCode}") — ระบบยึดเบอร์โทร`)
        }
      }
    }

    // ---- ยอดเงิน ----
    const grossRaw = cellText(row.getCell(colIndex('gross')))
    const gross = parseAmount(grossRaw)
    if (!grossRaw) errors.push('ไม่ได้กรอกยอดซื้อ')
    else if (gross === null) errors.push(`ยอดซื้ออ่านไม่ออก: "${grossRaw}" (ใส่แต่ตัวเลข)`)
    else if (gross <= 0) errors.push(`ยอดซื้อต้องมากกว่า 0 (ได้ ${gross})`)

    const discountRaw = cellText(row.getCell(colIndex('discount')))
    let discount = 0
    if (discountRaw) {
      const d = parseAmount(discountRaw)
      if (d === null) errors.push(`ยอดลดหนี้อ่านไม่ออก: "${discountRaw}" (ใส่แต่ตัวเลข)`)
      else if (d < 0) errors.push(`ยอดลดหนี้ติดลบไม่ได้ (ได้ ${d})`)
      else discount = d
    }
    if (gross !== null && gross > 0 && discount > gross) {
      errors.push(`ยอดลดหนี้ (${discount}) มากกว่ายอดซื้อ (${gross})`)
    }
    const net = gross !== null && gross > 0 && discount <= gross ? gross - discount : null

    // ---- Maker (sales_rep) ----
    const repRaw = cellText(row.getCell(colIndex('sales_rep')))
    let repCode: string | null = null
    let rep: SalesRepLookup | null = null
    if (!repRaw) {
      errors.push('ไม่ได้เลือก Maker')
    } else {
      // เซลล์เก็บ label "CODE · ชื่อ" · ยอมรับกรณีพิมพ์เฉพาะรหัสด้วย
      const idx = repRaw.indexOf(SEP)
      repCode = (idx > 0 ? repRaw.slice(0, idx) : repRaw).trim()
      rep = repByCode.get(repCode.toUpperCase()) ?? null
      if (!rep) errors.push(`ไม่พบ Maker "${repRaw}" ในระบบ — ให้บัญชีเพิ่มรายชื่อก่อน`)
      else if (!rep.is_active) errors.push(`Maker "${rep.code} · ${rep.full_name}" ถูกปิดใช้งานแล้ว`)
    }

    // ---- campaign + แต้ม ----
    const campaign = purchaseDate && !dateError ? findCampaign(purchaseDate) : null
    const multiplier = campaign ? Number(campaign.multiplier) : 1
    let points: number | null = null
    if (net !== null) {
      points = Math.round((net / ctx.bahtPerPoint) * multiplier)
      if (points <= 0) {
        errors.push(
          `ยอดสุทธิ ${net} คิดแต้มได้ 0 (อัตรา ${ctx.bahtPerPoint} บาท = 1 แต้ม) — ระบบไม่บันทึกรายการ 0 แต้ม`
        )
      }
    }

    // ---- ยอดซ้ำในไฟล์: เบอร์ + วันที่ซื้อ + ยอดสุทธิ (A4 · คีย์ชั่วคราวจนกว่า Q2 จะตอบ) ----
    // ตรวจเฉพาะแถวที่ไม่มี error อื่น (แถวที่ตกอยู่แล้วไม่ต้องเตือนซ้ำ และไม่ควรไปเป็น "แถวแรก" ให้แถวดีอ้าง)
    // แถวแรกที่เจอไม่ถูกตี แถวถัดไปอ้างกลับไปหาแถวแรก
    let duplicateOfRow: number | null = null
    if (errors.length === 0 && phone && purchaseDate && net !== null) {
      const key = `${phone}|${purchaseDate}|${net}`
      const first = amountSeenInFile.get(key)
      if (first) {
        duplicateOfRow = first
        const msg = `ยอดซ้ำกับแถว ${first} (เบอร์เดียวกัน วันเดียวกัน สุทธิ ${net.toLocaleString('en-US')} เท่ากัน)`
        if (dupPolicy === 'reject') errors.push(msg + ' — ระบบตั้งให้ปฏิเสธยอดซ้ำ')
        else warnings.push(msg)
      } else {
        amountSeenInFile.set(key, r)
      }
    }

    const status: RowStatus =
      errors.length === 0
        ? duplicateOfRow && dupPolicy === 'warn'
          ? 'duplicate_amount'
          : 'valid'
        : unmatchedOnly && errors.length === 1
          ? 'unmatched'
          : 'invalid'

    rows.push({
      row_no: r,
      customer_code: customerCode,
      purchase_date: purchaseDate,
      bill_no: billNo,
      phone,
      phone_raw: phoneRaw || null,
      customer_name: cellText(row.getCell(colIndex('customer_name'))) || null,
      gross,
      discount,
      net,
      sales_rep_code: repCode,
      sales_rep_id: rep?.id ?? null,
      sales_rep_name: rep?.full_name ?? null,
      campaign_id: campaign?.id ?? null,
      campaign_name: campaign?.name ?? null,
      multiplier,
      points,
      user_id: userId,
      note: cellText(row.getCell(colIndex('note'))) || null,
      status,
      errors,
      warnings,
      duplicate_of_row: duplicateOfRow,
    })
  }

  const awardable = rows.filter((r) => isAwardable(r.status))
  return {
    rows,
    summary: {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'valid').length,
      duplicate_amount: rows.filter((r) => r.status === 'duplicate_amount').length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      unmatched: rows.filter((r) => r.status === 'unmatched').length,
      warned: rows.filter((r) => r.warnings.length > 0).length,
      blank_skipped: blankSkipped,
      total_points: awardable.reduce((n, r) => n + (r.points ?? 0), 0),
    },
  }
}
