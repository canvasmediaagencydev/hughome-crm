/**
 * สร้าง workbook ของ template ยอดขาย — implementation เดียวที่ใช้ร่วมกัน 2 ที่:
 *   1. scripts/generate-sales-template.js  (plain node, require)
 *   2. GET /api/admin/batches/template     (Next route, import)
 *
 * เขียนเป็น CommonJS โดยตั้งใจ ให้ทั้ง node ธรรมดาและ bundler ของ Next ใช้ไฟล์เดียวกันได้
 * (tsconfig เปิด allowJs อยู่แล้ว) — ห้าม fork logic ไปเขียนซ้ำที่อื่น
 *
 * column spec อยู่ที่ sales-columns.json — ห้ามประกาศหัวตารางซ้ำที่นี่
 */
const ExcelJS = require('exceljs')
const SPEC = require('./sales-columns.json')

const HEADERS = SPEC.columns.map((c) => c.header)

function col(key) {
  const found = SPEC.columns.find((c) => c.key === key)
  if (!found) throw new Error(`column spec ไม่มี key "${key}" — sales-columns.json ถูกแก้?`)
  return found
}

/** label ใน dropdown · parser ตัดส่วนหน้า separator ไป match sales_reps.code */
function repLabel(rep) {
  return `${rep.code}${SPEC.salesRepSeparator}${rep.full_name}`
}

/**
 * @param {{code: string, full_name: string}[]} reps Maker (sales_reps) ที่ active — ต้องมีอย่างน้อย 1 คน
 * @returns {import('exceljs').Workbook}
 */
function buildSalesTemplate(reps) {
  if (!Array.isArray(reps) || reps.length === 0) {
    throw new Error('ต้องมี Maker อย่างน้อย 1 คน — เพิ่มรายชื่อที่ /admin/sales-reps ก่อน')
  }
  const seen = new Set()
  for (const r of reps) {
    if (!r || !r.code || !r.full_name) throw new Error('Maker ต้องมีทั้ง code และ full_name')
    const k = String(r.code).toUpperCase()
    if (seen.has(k)) throw new Error(`รหัส Maker ซ้ำ: ${r.code}`)
    seen.add(k)
    if (String(r.code).includes(SPEC.salesRepSeparator)) {
      throw new Error(`รหัส Maker "${r.code}" มีตัวคั่น "${SPEC.salesRepSeparator}" — parser จะตัดผิด`)
    }
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'HugHome CRM'

  // ---------- Sheet 1: แผ่นกรอกข้อมูล ----------
  const ws = wb.addWorksheet(SPEC.sheetName)
  ws.columns = SPEC.columns.map((c) => ({ header: c.header, key: c.key, width: c.width }))

  const header = ws.getRow(SPEC.headerRow)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle', horizontal: 'center' }
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } }
  })
  ws.views = [{ state: 'frozen', ySplit: SPEC.headerRow }]
  ws.autoFilter = {
    from: { row: SPEC.headerRow, column: 1 },
    to: { row: SPEC.headerRow, column: SPEC.columns.length },
  }

  // '@' = ข้อความ กัน Excel กินเลข 0 หน้าเบอร์/เลขบิล
  ws.getColumn(col('customer_code').key).numFmt = '@'
  ws.getColumn(col('purchase_date').key).numFmt = 'dd/mm/yyyy'
  ws.getColumn(col('bill_no').key).numFmt = '@'
  ws.getColumn(col('phone').key).numFmt = '@'
  ws.getColumn(col('gross').key).numFmt = '#,##0.00'
  ws.getColumn(col('discount').key).numFmt = '#,##0.00'

  // ---------- แผ่นซ่อนเก็บรายชื่อ Maker (แหล่งข้อมูลของ dropdown) ----------
  const staffWs = wb.addWorksheet(SPEC.staffSheetName, { state: 'veryHidden' })
  reps.forEach((r, i) => {
    staffWs.getCell(`A${i + 1}`).value = repLabel(r)
  })

  // ---------- data validation ----------
  const repCol = col('sales_rep').letter
  const dateCol = col('purchase_date').letter
  const grossCol = col('gross').letter
  const lastRow = SPEC.headerRow + SPEC.limits.validationRows

  for (let r = SPEC.headerRow + 1; r <= lastRow; r++) {
    ws.getCell(`${repCol}${r}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`${SPEC.staffSheetName}!$A$1:$A$${reps.length}`],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'Maker ไม่ถูกต้อง',
      error: 'เลือกชื่อจากรายการที่ระบบกำหนดเท่านั้น ห้ามพิมพ์เอง',
    }
    ws.getCell(`${dateCol}${r}`).dataValidation = {
      type: 'date',
      operator: 'greaterThan',
      allowBlank: true,
      formulae: [new Date(2020, 0, 1)],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'วันที่ไม่ถูกต้อง',
      error: 'กรอกเป็นวันที่ เช่น 27/07/2026 (ระบบรับ พ.ศ. ด้วย)',
    }
    ws.getCell(`${grossCol}${r}`).dataValidation = {
      type: 'decimal',
      operator: 'greaterThan',
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorStyle: 'stop',
      errorTitle: 'ยอดซื้อไม่ถูกต้อง',
      error: 'ยอดซื้อต้องมากกว่า 0 · ใส่แต่ตัวเลข ห้ามคอมม่าหรือคำว่า "บาท"',
    }
  }

  // ---------- Sheet 2: คำแนะนำ ----------
  const req = (key) => (col(key).required ? 'จำเป็น' : 'ไม่จำเป็น')
  const guideRows = [
    ['คำแนะนำการกรอกข้อมูลยอดซื้อ — HugHome Hug Point'],
    [],
    ['*** ห้ามแก้ชื่อหัวตาราง ห้ามสลับลำดับคอลัมน์ ห้ามเพิ่ม/ลบคอลัมน์ ***'],
    [`ระบบอ่านไฟล์จากชื่อหัวตารางในแถวที่ ${SPEC.headerRow} ของแผ่น "${SPEC.sheetName}" เท่านั้น`],
    [],
    ['── คอลัมน์ ──'],
    ['คอลัมน์', 'จำเป็น', 'รูปแบบ', 'คำอธิบาย'],
    [
      col('customer_code').header,
      req('customer_code'),
      'ข้อความ',
      'รหัสลูกค้าตามระบบ (ดูได้จากหน้าโปรไฟล์ของลูกค้า/หลังบ้าน) · ระบบจับคู่ด้วย "เบอร์โทร" เป็นหลัก รหัสใช้ตรวจทานซ้ำ — ถ้ารหัสกับเบอร์ไม่ตรงกัน ระบบเตือนในหน้า preview',
    ],
    [
      col('purchase_date').header,
      req('purchase_date'),
      'วันที่',
      'วันที่เกิดรายการซื้อ · ใช้หาตัวคูณแคมเปญและตรวจว่าอยู่ในสัปดาห์ที่บัญชีเลือกตอนอัปโหลด · กรอก พ.ศ. ได้ ระบบแปลงให้ · (อายุแต้มนับจากวันที่ผู้อนุมัติกดอนุมัติ ไม่ใช่วันที่ซื้อ)',
    ],
    [
      col('bill_no').header,
      req('bill_no'),
      'ข้อความ',
      'เลขที่บิล/ใบเสร็จตามเอกสารจริง · ระบบกันเลขซ้ำทั้งระบบ คีย์บิลเดิมสองครั้งจะถูก reject · ใช้ตอนผู้จัดการสุ่มตรวจย้อนกลับ',
    ],
    [
      col('phone').header,
      req('phone'),
      'ข้อความ 10 หลัก',
      'เบอร์ของ "เจ้าของบัญชีแต้ม" · ถ้าเลข 0 หน้าหาย ระบบเติมให้อัตโนมัติ (8xx → 08xx)',
    ],
    [col('customer_name').header, req('customer_name'), 'ข้อความ', 'ใช้ตรวจทานเฉยๆ · ระบบจับคู่ด้วยเบอร์โทร'],
    [col('gross').header, req('gross'), 'ตัวเลข', 'ยอดก่อนหักลดหนี้ · ห้ามใส่คอมม่าหรือคำว่า "บาท" · เช่น 2500.50'],
    [col('discount').header, req('discount'), 'ตัวเลข', 'ยอดคืนของ/ลดหนี้ · เว้นว่างได้ ระบบนับเป็น 0 · ต้องไม่เกินยอดซื้อ'],
    [
      col('sales_rep').header,
      req('sales_rep'),
      'เลือกจากรายการ',
      'กดลูกศรในเซลล์แล้วเลือกชื่อ · ห้ามพิมพ์เอง · ถ้าไม่เจอชื่อตัวเอง แจ้งบัญชีให้เพิ่มในระบบหลังบ้านก่อน',
    ],
    [col('note').header, req('note'), 'ข้อความ', 'บันทึกภายใน ไม่ส่งถึงลูกค้า'],
    [],
    ['── ตัวอย่างการกรอก ──'],
    HEADERS,
    ['HH-000123', '01/07/2026', 'INV-2026-0731', '0812345678', 'สมชาย ใจดี', 2500, 0, repLabel(reps[0]), ''],
    [
      'HH-000456',
      '03/07/2026',
      'INV-2026-0742',
      '0898765432',
      'วรรณภา ช่วยชุบ',
      12000,
      1500,
      repLabel(reps[reps.length - 1]),
      'คืนกระเบื้อง 2 กล่อง',
    ],
    [],
    ['── สูตรคำนวณแต้ม (ระบบคิดให้อัตโนมัติ) ──'],
    ['ยอดสุทธิ = ยอดซื้อ − ยอดลดหนี้'],
    ['แต้ม = ปัดเศษ( ยอดสุทธิ ÷ อัตราแลกแต้ม × ตัวคูณแคมเปญ )'],
    ['อัตราแลกแต้มตั้งค่าในระบบหลังบ้าน (ค่าเริ่มต้น 100 บาท = 1 แต้ม)'],
    [],
    ['── อายุแต้ม ──'],
    ['แต้มมีอายุ 365 วัน นับจากวันที่ผู้อนุมัติกดอนุมัติชุดนั้น (ไม่ใช่วันที่ซื้อ) · แต้มที่อนุมัติพร้อมกันจะหมดอายุวันเดียวกัน'],
    [],
    ['── แคมเปญแต้มพิเศษ ──'],
    ['Maker "ไม่ต้อง" กรอกโค้ดโปรโมชันในไฟล์นี้ และไม่มีคอลัมน์ให้กรอก'],
    ['ผู้ดูแลตั้งแคมเปญไว้หลังบ้านเป็นช่วงวันที่ (เช่น 1–15 ก.ค. ได้แต้ม 2 เท่า)'],
    ['ระบบจับคู่ตัวคูณจาก "วันที่ซื้อ" ของแต่ละแถวให้เอง — กันการใส่ตัวคูณเกินสิทธิ์'],
    [],
    ['── ข้อผิดพลาดที่พบบ่อย ──'],
    ['1. เลข 0 หน้าเบอร์หาย (812345678)', 'ระบบเติมให้ แต่คอลัมน์นี้ตั้งรูปแบบ "ข้อความ" ไว้แล้ว ไม่ควรหาย'],
    ['2. ใส่คอมม่าในยอดเงิน (2,500)', 'ให้พิมพ์ 2500 เฉยๆ'],
    ['3. ใส่คำว่า "บาท" ต่อท้ายยอด', 'ใส่แต่ตัวเลข'],
    ['4. กรอกเบอร์คนที่มาซื้อแทนเจ้าของบัญชี', 'ต้องกรอกเบอร์ "เจ้าของแต้ม" เสมอ แม้ฝากคนอื่นมาซื้อ'],
    ['5. เลขที่บิลซ้ำกับที่ส่งไปแล้ว', 'ระบบ reject แถวนั้น · ถ้าบิลเดิมผิดต้องให้ผู้อนุมัติยกเลิกทั้งชุด (Rollback) ก่อน'],
    ['6. วันที่ซื้อหลุดออกนอกสัปดาห์ที่ส่ง', 'ระบบ reject แถวนั้น · ยอดข้ามสัปดาห์ให้แยกไฟล์'],
    ['7. พิมพ์ชื่อ Maker เอง', 'ต้องเลือกจาก dropdown เท่านั้น'],
    ['8. มีแถวว่างคั่นกลาง', 'ระบบข้ามให้ แต่ควรลบออกเพื่อความชัดเจน'],
    ['9. ลูกค้าคนเดียว วันเดียวกัน ยอดสุทธิเท่ากัน 2 แถว', 'ระบบไม่ reject แต่ขึ้นเตือน "ยอดซ้ำ" ให้ผู้อนุมัติเห็นในหน้า preview'],
    ['10. รหัสลูกค้ากับเบอร์โทรไม่ตรงกัน', 'ระบบยึดเบอร์โทร และขึ้นเตือนในหน้า preview'],
    [],
    ['── ขั้นตอนการทำงาน ──'],
    [`1. Maker กรอกลงแผ่น "${SPEC.sheetName}" ทุกวัน (paste หลายรายการพร้อมกันได้)`],
    ['2. ส่งไฟล์ให้บัญชีทุกสัปดาห์'],
    ['3. บัญชี upload เข้าระบบหลังบ้าน → เลือกช่วงสัปดาห์ → ตรวจหน้า preview → กด "ส่งให้ผู้อนุมัติ"'],
    ['4. ผู้อนุมัติตรวจชุดนั้นแล้วกด "อนุมัติ" → แต้มเข้าบัญชีลูกค้า และลูกค้าได้รับแจ้งทาง LINE'],
    ['5. ถ้าชุดไหนผิด ผู้อนุมัติกด "ปฏิเสธ" (ก่อนแต้มเข้า) หรือ "ยกเลิกทั้งชุด (Rollback)" (หลังแต้มเข้า) แล้วบัญชีอัปโหลดไฟล์ที่แก้แล้วใหม่'],
    [],
    [
      `ข้อจำกัดไฟล์: ไม่เกิน ${(SPEC.limits.maxFileBytes / 1024 / 1024).toFixed(0)} MB และไม่เกิน ${SPEC.limits.maxDataRows.toLocaleString('en-US')} แถว`,
    ],
  ]

  const guideWs = wb.addWorksheet(SPEC.guideSheetName)
  guideRows.forEach((r) => guideWs.addRow(r))
  guideWs.getColumn(1).width = 34
  guideWs.getColumn(2).width = 14
  guideWs.getColumn(3).width = 18
  guideWs.getColumn(4).width = 62
  guideWs.getRow(1).font = { bold: true, size: 14 }
  guideWs.getRow(3).font = { bold: true, color: { argb: 'FFC00000' } }

  return wb
}

module.exports = { buildSalesTemplate, repLabel, HEADERS, SPEC }
