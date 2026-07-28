/**
 * สร้างไฟล์ Excel สาธิต docs/demo/ ที่ "อัปโหลดแล้วผ่านทันที"
 *
 *   node scripts/build-demo-batch.js
 *
 * ข้อมูลต้องตรงกับ supabase/seed/seed_demo_data.sql (พนักงาน 4 คน · ลูกค้า 8 คน · แคมเปญ x2)
 * ถ้าแก้ seed ต้องแก้ไฟล์นี้ให้ตรงกันแล้ว generate ใหม่
 *
 * ใช้ builder ตัวเดียวกับ template จริง (src/lib/excel/build-template.js)
 * → ไฟล์สาธิตมี dropdown / freeze / รูปแบบเซลล์ เหมือนของจริงทุกอย่าง
 */
const fs = require('fs')
const path = require('path')
const { buildSalesTemplate, repLabel, SPEC } = require('../src/lib/excel/build-template')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'demo')

// ---- ต้องตรงกับ seed_demo_data.sql ----
const REPS = [
  { code: 'S01', full_name: 'สมชาย มั่นคง' },
  { code: 'S02', full_name: 'ปราณี ศรีสุข' },
  { code: 'S03', full_name: 'ธนากร ใจงาม' },
  { code: 'S04', full_name: 'จันทร์เพ็ญ ทองดี' },
]
const byCode = Object.fromEntries(REPS.map((r) => [r.code, r]))

/** สัปดาห์ที่ปิดแล้ว จ.20 – อา.26 ก.ค. 2026 — วันที่ซื้อไม่เป็นอนาคต */
const WEEK = { start: '2026-07-20', end: '2026-07-26' }
/** แคมเปญ x2 = 23 ก.ค. – 5 ส.ค. → คลุมแค่ครึ่งหลังของสัปดาห์ */
const CAMPAIGN = { from: '2026-07-23', to: '2026-08-05', multiplier: 2 }

const d = (iso) => {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day)) // UTC เสมอ — parser อ่านด้วย getUTC*
}

// วันที่ | เลขบิล | เบอร์ | ชื่อ | ยอดซื้อ | ลดหนี้ | พนักงาน | หมายเหตุ | เจตนา
const ROWS = [
  ['2026-07-20', 'DM-2607-001', '0800000001', 'สมชาย มั่นคง',      2500,  0,    'S01', '',                    'ปกติ · นอกแคมเปญ'],
  ['2026-07-20', 'DM-2607-002', '0800000002', 'ปราณี ศรีสุข',       12000, 1500, 'S02', 'คืนกระเบื้อง 2 กล่อง', 'มียอดลดหนี้'],
  ['2026-07-21', 'DM-2607-003', '0800000003', 'ธนากร ใจงาม',       4837,  0,    'S01', 'ผู้รับเหมา',           'เศษสตางค์ ปัดลง'],
  ['2026-07-22', 'DM-2607-004', '0800000004', 'วรรณภา พูนผล',      850,   0,    'S03', '',                    'ปัดขึ้นครึ่งแต้ม'],
  ['2026-07-23', 'DM-2607-005', '0800000005', 'อนุชา แก้วใส',       6000,  0,    'S02', '',                    'เข้าแคมเปญ x2'],
  ['2026-07-24', 'DM-2607-006', '0800000006', 'จันทร์เพ็ญ ทองดี',  15750, 750,  'S04', 'ยอดใหญ่',             'x2 + ลดหนี้'],
  ['2026-07-25', 'DM-2607-007', '0800000007', 'ประเสริฐ วงศ์ไทย',   3300,  300,  'S03', '',                    'x2 + ลดหนี้'],
  ['2026-07-26', 'DM-2607-008', '0800000008', 'มาลี บุญมาก',        990,   0,    'S04', '',                    'x2 ปัดขึ้น'],
  ['2026-07-24', 'DM-2607-009', '0899999999', 'ลูกค้ายังไม่สมัคร',   5000,  0,    'S01', '',                    '❌ เบอร์ไม่มีในระบบ → unmatched'],
  ['2026-07-25', 'DM-2607-010', '0800000001', 'สมชาย มั่นคง',      1200,  1500, 'S02', 'คีย์ผิด',              '❌ ลดหนี้เกินยอดซื้อ → invalid'],
]

async function main() {
  const wb = buildSalesTemplate(REPS)
  const ws = wb.getWorksheet(SPEC.sheetName)

  ROWS.forEach((r, i) => {
    const row = ws.getRow(SPEC.headerRow + 1 + i)
    row.getCell(1).value = d(r[0])
    row.getCell(2).value = r[1]
    row.getCell(3).value = r[2]
    row.getCell(4).value = r[3]
    row.getCell(5).value = r[4]
    row.getCell(6).value = r[5]
    row.getCell(7).value = repLabel(byCode[r[6]])
    row.getCell(8).value = r[7]
    row.commit()
  })

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outFile = path.join(OUT_DIR, `demo-ยอดขาย-${WEEK.start}_${WEEK.end}.xlsx`)
  await wb.xlsx.writeFile(outFile)

  // ---- คำนวณแต้มที่คาดหวัง (คิดมือ ไม่ผ่าน parser) เพื่อเอาไปเทียบกันทีหลัง ----
  const expected = ROWS.map((r) => {
    const net = r[4] - r[5]
    const inCampaign = r[0] >= CAMPAIGN.from && r[0] <= CAMPAIGN.to
    const mult = inCampaign ? CAMPAIGN.multiplier : 1
    const bad = r[2] === '0899999999' || r[5] > r[4]
    return { bill: r[1], net, mult, points: bad ? null : Math.round((net / 100) * mult), note: r[8] }
  })
  const totalPoints = expected.filter((e) => e.points !== null).reduce((n, e) => n + e.points, 0)

  console.log('written:', outFile)
  console.log(`สัปดาห์ที่ต้องเลือกตอนอัปโหลด: ${WEEK.start} → ${WEEK.end}`)
  console.log('\nแต้มที่คาดหวัง (คิดมือ · baht_per_point = 100):')
  for (const e of expected) {
    console.log(
      `  ${e.bill}  สุทธิ ${String(e.net).padStart(6)} × ${e.mult}  → ${String(e.points ?? '—').padStart(4)} แต้ม   ${e.note}`
    )
  }
  console.log(`\n  รวมแต้มจากแถวที่ใช้ได้ = ${totalPoints}`)

  fs.writeFileSync(
    path.join(OUT_DIR, 'expected.json'),
    JSON.stringify({ week: WEEK, campaign: CAMPAIGN, expected, totalPoints }, null, 2)
  )
}

main().catch((e) => {
  console.error('\n' + e.message + '\n')
  process.exit(1)
})
