/**
 * สร้าง workbook ของรายงาน 2 ตัว (Sprint 9R A5) — implementation เดียวใช้ร่วมกัน:
 *   1. GET /api/admin/reports/users/excel          → buildCustomerExport   (ลูกค้า 1 แถว = 1 คน · ไม่มีเลขบิล)
 *   2. GET /api/admin/reports/batches/:id/excel    → buildBatchReport      (1 แถว = 1 บิล · มีเลขบิล + Maker + สาขา)
 *   3. scripts/build-sample-reports.js             → ไฟล์ตัวอย่างส่งลูกค้า (ไม่แตะ DB)
 *
 * CommonJS โดยตั้งใจ เหมือน build-template.js — ห้าม fork logic ไปเขียนซ้ำใน route
 * เป็น pure function: รับข้อมูลที่ route/สคริปต์เตรียมมาแล้ว ไม่แตะ DB
 *
 * ทำไม 2 รายงาน (wiki/12 §5, wiki/14 §3 "Reports"):
 *   - ฝั่งการตลาดของลูกค้าเอาไปใช้ต่อ → ห้ามมีเลขบิล · เบอร์ 10 หลักติดกัน ไม่มีขีด
 *   - ผู้อนุมัติ/ผู้จัดการเอาไปเทียบบิลกระดาษ → "ต้องมี" เลขบิล (MIGRATION_PLAN.md §8.2)
 */
const ExcelJS = require('exceljs')

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
const HEADER_BORDER = { bottom: { style: 'thin', color: { argb: 'FF999999' } } }

/** 'YYYY-MM-DD' หรือ ISO timestamp → 'dd/mm/yyyy' ปี พ.ศ. (วันที่ตามเวลาไทย) */
function thaiDate(value) {
  if (!value) return ''
  const s = String(value)
  let y, m, d
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    ;[y, m, d] = s.split('-').map(Number)
  } else {
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return s
    // แปลงเป็นวันที่ตามโซนไทยก่อนตัดเวลา — timestamp UTC ตอนเที่ยงคืนไทยคือวันก่อนหน้าใน UTC
    const bkk = new Date(dt.getTime() + 7 * 60 * 60 * 1000)
    y = bkk.getUTCFullYear()
    m = bkk.getUTCMonth() + 1
    d = bkk.getUTCDate()
  }
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y + 543}`
}

function roleLabel(role) {
  if (role === 'contractor') return 'ช่าง'
  if (role === 'homeowner') return 'เจ้าของบ้าน'
  return ''
}

/** เบอร์ 10 หลักติดกัน — ห้ามใส่ขีด (ลูกค้าเอาไป vlookup ต่อ) · เก็บใน DB เป็น local 10 หลักอยู่แล้ว (phone.ts) */
function plainPhone(phone) {
  if (!phone) return ''
  return String(phone).replace(/\D/g, '')
}

function styleHeader(ws, colCount) {
  const header = ws.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  for (let c = 1; c <= colCount; c++) {
    const cell = header.getCell(c)
    cell.fill = HEADER_FILL
    cell.border = HEADER_BORDER
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } }
}

// ---------------------------------------------------------------------------
// 1. Customer export — 1 แถว = 1 ลูกค้า · ไม่มีคอลัมน์เลขที่บิลโดยเจตนา
// ---------------------------------------------------------------------------
const CUSTOMER_COLUMNS = [
  { key: 'customer_code', header: 'รหัสลูกค้า', width: 14, numFmt: '@' },
  { key: 'first_name', header: 'ชื่อ', width: 16 },
  { key: 'last_name', header: 'นามสกุล', width: 18 },
  { key: 'phone', header: 'เบอร์โทร', width: 14, numFmt: '@' },
  { key: 'role', header: 'ประเภท', width: 12 },
  { key: 'created_at', header: 'วันที่สมัคร', width: 13 },
  { key: 'points_balance', header: 'แต้มคงเหลือ', width: 12, numFmt: '#,##0' },
  { key: 'next_expiry_points', header: 'แต้มที่จะหมดอายุก้อนถัดไป', width: 16, numFmt: '#,##0' },
  { key: 'next_expiry_date', header: 'วันหมดอายุก้อนถัดไป', width: 15 },
  { key: 'net_in_range', header: 'ยอดซื้อสุทธิรวมในช่วง', width: 18, numFmt: '#,##0.00' },
  { key: 'bills_in_range', header: 'จำนวนบิลในช่วง', width: 13, numFmt: '#,##0' },
  { key: 'tags', header: 'แท็ก', width: 24 },
]

/**
 * @param {{
 *   rangeStart: string, rangeEnd: string,
 *   customers: {
 *     customer_code: string|null, first_name: string|null, last_name: string|null, phone: string|null,
 *     role: string|null, created_at: string, points_balance: number,
 *     next_expiry_points: number|null, next_expiry_date: string|null,
 *     net_in_range: number, bills_in_range: number, tags: string[]
 *   }[]
 * }} input
 */
function buildCustomerExport(input) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input.rangeStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.rangeEnd)) {
    throw new Error('buildCustomerExport ต้องได้ rangeStart/rangeEnd เป็น YYYY-MM-DD')
  }
  if (!Array.isArray(input.customers)) throw new Error('buildCustomerExport ต้องได้ customers เป็น array')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HugHome CRM'
  const ws = wb.addWorksheet('ลูกค้า')
  ws.columns = CUSTOMER_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))
  for (const c of CUSTOMER_COLUMNS) if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt

  for (const u of input.customers) {
    ws.addRow({
      customer_code: u.customer_code ?? '',
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      phone: plainPhone(u.phone),
      role: roleLabel(u.role),
      created_at: thaiDate(u.created_at),
      points_balance: u.points_balance ?? 0,
      next_expiry_points: u.next_expiry_points ?? '',
      next_expiry_date: u.next_expiry_date ? thaiDate(u.next_expiry_date) : '',
      net_in_range: Number(u.net_in_range ?? 0),
      bills_in_range: Number(u.bills_in_range ?? 0),
      tags: Array.isArray(u.tags) ? u.tags.join(', ') : '',
    })
  }
  // เบอร์เป็นข้อความเสมอ (ตั้ง numFmt ที่คอลัมน์ไม่พอถ้าเซลล์ถูกใส่เป็น number ที่ไหนสักแห่ง)
  ws.getColumn('phone').eachCell({ includeEmpty: false }, (cell, rowNo) => {
    if (rowNo > 1) cell.value = String(cell.value ?? '')
  })
  styleHeader(ws, CUSTOMER_COLUMNS.length)

  const meta = wb.addWorksheet('หมายเหตุ')
  meta.addRow(['รายงานลูกค้า — HugHome Hug Point'])
  meta.addRow([`ช่วงที่ใช้คำนวณ "ยอดซื้อสุทธิรวมในช่วง" และ "จำนวนบิลในช่วง": ${thaiDate(input.rangeStart)} ถึง ${thaiDate(input.rangeEnd)} (ตามวันที่ซื้อ)`])
  meta.addRow(['1 แถว = ลูกค้า 1 คน · รายงานนี้ไม่มีเลขที่บิลโดยตั้งใจ (รายงานตรวจบิลอยู่ที่หน้า "อัปโหลดยอดขาย" รายชุด)'])
  meta.addRow(['เบอร์โทรเป็นข้อความ 10 หลักไม่มีขีด · แต้มคงเหลือ = ณ เวลาที่ออกรายงาน'])
  meta.addRow([`ออกรายงานเมื่อ ${thaiDate(new Date().toISOString())}`])
  meta.getColumn(1).width = 110
  meta.getRow(1).font = { bold: true, size: 13 }

  return wb
}

function customerExportFilename(rangeStart, rangeEnd) {
  return `customers_${rangeStart}_${rangeEnd}.xlsx`
}

// ---------------------------------------------------------------------------
// 2. Weekly batch report — 1 แถว = 1 บิล · มีเลขบิลโดยตั้งใจ (wiki/12 §5) ห้ามลบ
// ---------------------------------------------------------------------------
const BATCH_COLUMNS = [
  { key: 'purchase_date', header: 'วันที่ซื้อ', width: 13 },
  { key: 'bill_no', header: 'เลขที่บิล', width: 18, numFmt: '@' },
  { key: 'customer_code', header: 'รหัสลูกค้า', width: 14, numFmt: '@' },
  { key: 'phone', header: 'เบอร์โทร', width: 14, numFmt: '@' },
  { key: 'customer_name', header: 'ชื่อลูกค้า', width: 24 },
  { key: 'gross', header: 'ยอดซื้อ', width: 12, numFmt: '#,##0.00' },
  { key: 'discount', header: 'ลดหนี้', width: 11, numFmt: '#,##0.00' },
  { key: 'net', header: 'สุทธิ', width: 12, numFmt: '#,##0.00' },
  { key: 'multiplier', header: 'ตัวคูณ', width: 8, numFmt: '0.##' },
  { key: 'points', header: 'แต้ม', width: 9, numFmt: '#,##0' },
  { key: 'sales_rep', header: 'Maker', width: 26 },
  { key: 'branch', header: 'สาขา', width: 14 },
]

/**
 * @param {{
 *   branchName: string,
 *   batch: { file_name: string, week_start: string, week_end: string, status: string,
 *            uploaded_by_name?: string|null, submitted_by_name?: string|null, committed_by_name?: string|null,
 *            committed_at?: string|null, voided_by_name?: string|null, void_reason?: string|null },
 *   rows: { purchase_date: string|null, bill_no: string|null, customer_code: string|null, phone: string|null,
 *           customer_name: string|null, gross: number|null, discount: number, net: number|null,
 *           multiplier: number, points: number|null, sales_rep: string|null }[]
 * }} input  rows = เฉพาะแถวที่ได้แต้ม (valid + duplicate_amount)
 */
function buildBatchReport(input) {
  if (!input || !input.branchName) throw new Error('buildBatchReport ต้องได้ branchName (TENANT.name)')
  if (!input.batch || !Array.isArray(input.rows)) throw new Error('buildBatchReport ต้องได้ batch + rows')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HugHome CRM'
  const ws = wb.addWorksheet('รายการบิล')
  ws.columns = BATCH_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }))
  for (const c of BATCH_COLUMNS) if (c.numFmt) ws.getColumn(c.key).numFmt = c.numFmt

  let sumGross = 0
  let sumDiscount = 0
  let sumNet = 0
  let sumPoints = 0
  for (const r of input.rows) {
    const gross = Number(r.gross ?? 0)
    const discount = Number(r.discount ?? 0)
    const net = Number(r.net ?? 0)
    const points = Number(r.points ?? 0)
    sumGross += gross
    sumDiscount += discount
    sumNet += net
    sumPoints += points
    ws.addRow({
      purchase_date: thaiDate(r.purchase_date),
      bill_no: r.bill_no ?? '',
      customer_code: r.customer_code ?? '',
      phone: plainPhone(r.phone),
      customer_name: r.customer_name ?? '',
      gross,
      discount,
      net,
      multiplier: Number(r.multiplier ?? 1),
      points,
      sales_rep: r.sales_rep ?? '',
      branch: input.branchName,
    })
  }
  const total = ws.addRow({
    purchase_date: 'รวม',
    bill_no: `${input.rows.length} บิล`,
    gross: sumGross,
    discount: sumDiscount,
    net: sumNet,
    points: sumPoints,
  })
  total.font = { bold: true }
  total.eachCell((cell) => {
    cell.border = { top: { style: 'thin', color: { argb: 'FF999999' } } }
  })
  ws.getColumn('phone').eachCell({ includeEmpty: false }, (cell, rowNo) => {
    if (rowNo > 1 && rowNo <= input.rows.length + 1) cell.value = String(cell.value ?? '')
  })
  styleHeader(ws, BATCH_COLUMNS.length)

  const b = input.batch
  const meta = wb.addWorksheet('ข้อมูลชุด')
  const metaRows = [
    ['รายงานชุดยอดขาย — HugHome Hug Point'],
    ['สาขา', input.branchName],
    ['ไฟล์', b.file_name],
    ['สัปดาห์', `${thaiDate(b.week_start)} ถึง ${thaiDate(b.week_end)}`],
    ['สถานะ', b.status],
    ['อัปโหลดโดย', b.uploaded_by_name ?? ''],
    ['ส่งให้ผู้อนุมัติโดย', b.submitted_by_name ?? ''],
    ['อนุมัติ (แต้มเข้า) โดย', b.committed_by_name ?? ''],
    ['อนุมัติเมื่อ', b.committed_at ? thaiDate(b.committed_at) : ''],
    ['ยกเลิกโดย', b.voided_by_name ?? ''],
    ['เหตุผลที่ยกเลิก', b.void_reason ?? ''],
    ['จำนวนบิลที่ได้แต้ม', input.rows.length],
    ['แต้มรวม', sumPoints],
    [],
    ['รายงานนี้มีเลขที่บิลโดยตั้งใจ — ใช้เทียบกับบิลกระดาษ (ผู้อนุมัติ/ผู้จัดการ) · ห้ามส่งต่อภายนอก'],
    [`ออกรายงานเมื่อ ${thaiDate(new Date().toISOString())}`],
  ]
  metaRows.forEach((r) => meta.addRow(r))
  meta.getColumn(1).width = 24
  meta.getColumn(2).width = 60
  meta.getRow(1).font = { bold: true, size: 13 }

  return wb
}

function batchReportFilename(batch) {
  return `batch_${batch.week_start}_${batch.week_end}.xlsx`
}

module.exports = {
  XLSX_MIME,
  CUSTOMER_COLUMNS,
  BATCH_COLUMNS,
  buildCustomerExport,
  customerExportFilename,
  buildBatchReport,
  batchReportFilename,
  thaiDate,
  plainPhone,
}
