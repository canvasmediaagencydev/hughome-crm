/**
 * Self-check ของ Sprint 4 — ทดสอบ parser ตรง ๆ ไม่ต้องมี DB/session
 *
 *   node scripts/test-parse-sales-batch.js
 *
 * สร้างไฟล์ .xlsx ทดสอบเองทุกเคสตามที่ docs/PROMPTS.md Sprint 4 กำหนด แล้ว assert ผลลัพธ์
 * (ไม่มี test framework ในโปรเจกต์ — ตัวนี้เป็น script ธรรมดา exit 1 ถ้าตก)
 *
 * transpile .ts ด้วย TypeScript compiler API ลง temp dir เพราะ parser เป็น TS
 * และ node รัน path alias '@/...' เองไม่ได้
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const ExcelJS = require('exceljs')

const ROOT = path.join(__dirname, '..')
fs.mkdirSync(path.join(ROOT, 'node_modules', '.cache'), { recursive: true })
const SPEC = require('../src/lib/excel/sales-columns.json')
const HEADERS = SPEC.columns.map((c) => c.header)

// ---------------------------------------------------------------------------
// transpile parser → temp ESM
// ---------------------------------------------------------------------------
function buildModule() {
  // ต้องอยู่ใต้ ROOT ไม่งั้น node resolve 'exceljs' ไม่เจอ (temp dir ของระบบไม่มี node_modules)
  const out = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.cache', 'salesparse-'))
  const emit = (srcRel, destName, rewrite = (s) => s) => {
    const src = fs.readFileSync(path.join(ROOT, srcRel), 'utf8')
    const js = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
    fs.writeFileSync(path.join(out, destName), rewrite(js))
  }
  emit('src/lib/phone.ts', 'phone.mjs')
  emit('src/lib/excel/parse-sales-batch.ts', 'parser.mjs', (js) => {
    const rewritten = js
      .replace(/from ['"]@\/lib\/phone['"]/g, "from './phone.mjs'")
      // ฝัง spec ลงไปตรง ๆ แทน import JSON — เลี่ยง import attributes ของ ESM ไปเลย
      .replace(
        /import\s+SPEC\s+from\s+['"]\.\/sales-columns\.json['"];?/,
        `const SPEC = ${JSON.stringify(SPEC)};`
      )
    // เช็คเฉพาะ import ที่ค้าง — ชื่อไฟล์โผล่ในคอมเมนต์ของ parser ด้วย ห้ามนับเป็น false positive
    if (/from\s+['"][^'"]*sales-columns\.json['"]/.test(rewritten)) {
      throw new Error('rewrite ไม่สำเร็จ — ยังมี import sales-columns.json ค้างอยู่')
    }
    if (/from\s+['"]@\//.test(rewritten)) {
      throw new Error('rewrite ไม่สำเร็จ — ยังมี path alias @/ ค้างอยู่')
    }
    return rewritten
  })
  return out
}

// ---------------------------------------------------------------------------
// helpers สร้างไฟล์ทดสอบ
// ---------------------------------------------------------------------------
async function makeWorkbook(rows, opts = {}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(opts.sheetName ?? SPEC.sheetName)
  ws.addRow(opts.headers ?? HEADERS)
  for (const r of rows) ws.addRow(r)
  if (opts.mutate) opts.mutate(ws)
  if (opts.extraSheet) wb.addWorksheet(opts.extraSheet)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const REPS = [
  { id: 'rep-1', code: 'S01', full_name: 'สมชาย ใจดี', is_active: true },
  { id: 'rep-2', code: 'S02', full_name: 'วรรณภา ช่วยชุบ', is_active: true },
  { id: 'rep-3', code: 'S09', full_name: 'ลาออกแล้ว', is_active: false },
]
const CAMPAIGNS = [
  { id: 'camp-1', name: 'กลางปี x2', multiplier: 2, starts_on: '2026-07-01', ends_on: '2026-07-10' },
]
const ctx = (over = {}) => ({
  weekStart: '2026-07-06',
  weekEnd: '2026-07-12',
  bahtPerPoint: 100,
  salesReps: REPS,
  activeCampaigns: CAMPAIGNS,
  usersByPhone: new Map([
    ['0812345678', 'user-1'],
    ['0898765432', 'user-2'],
  ]),
  billsInUse: new Map([['OLD-001', 'batch-เก่า']]),
  ...over,
})

const rep = (r) => `${r.code}${SPEC.salesRepSeparator}${r.full_name}`

// ---------------------------------------------------------------------------
let pass = 0
const failures = []
function check(label, cond, detail) {
  if (cond) {
    pass++
    console.log('  ✅ ' + label)
  } else {
    failures.push(label + (detail ? ` — ${detail}` : ''))
    console.log('  ❌ ' + label + (detail ? ` — ${detail}` : ''))
  }
}
const hasErr = (row, needle) => row.errors.some((e) => e.includes(needle))

async function main() {
  const dir = buildModule()
  const { parseSalesBatch, BatchFileError } = await import(path.join(dir, 'parser.mjs'))

  // ======================================================================
  console.log('\n[1] template เปล่า (มีแต่หัวตาราง + data validation) → 0 แถว ไม่ error')
  {
    const tpl = fs.readFileSync(path.join(ROOT, 'docs/Hughome_Sales_Staff_Template.xlsx'))
    const r = await parseSalesBatch(tpl, ctx())
    check('อ่านผ่าน ไม่ throw', true)
    check('total = 0', r.summary.total === 0, `ได้ ${r.summary.total}`)
    check('rows ว่าง', r.rows.length === 0, `ได้ ${r.rows.length}`)
  }

  // ======================================================================
  console.log('\n[2] ไฟล์รวมทุกเคส')
  {
    const rows = [
      // 2: ปกติ + อยู่ในช่วง campaign x2 → (5000-0)/100*2 = 100
      ['06/07/2026', 'INV-001', '0812345678', 'สมชาย', 5000, 0, rep(REPS[0]), ''],
      // 3: เลข 0 หน้าเบอร์หาย + ยอดมีคอมม่า + นอกช่วง campaign → (12000-1500)/100*1 = 105
      ['11/07/2026', 'INV-002', '898765432', 'วรรณภา', '12,000', '1,500', rep(REPS[1]), 'คืนของ'],
      // 4: วันที่เป็น พ.ศ. (2569 = 2026)
      ['08/07/2569', 'INV-003', '0812345678', 'พ.ศ.', 1000, 0, rep(REPS[0]), ''],
      // 5: วันที่หลุดนอกสัปดาห์
      ['01/07/2026', 'INV-004', '0812345678', 'นอกสัปดาห์', 1000, 0, rep(REPS[0]), ''],
      // 6: เลขบิลซ้ำในไฟล์เดียวกัน (ซ้ำกับแถว 2)
      ['07/07/2026', 'inv-001', '0812345678', 'บิลซ้ำในไฟล์', 1000, 0, rep(REPS[0]), ''],
      // 7: เลขบิลซ้ำกับ batch เก่า
      ['07/07/2026', 'OLD-001', '0812345678', 'บิลซ้ำ DB', 1000, 0, rep(REPS[0]), ''],
      // 8: พนักงานขายไม่มีในระบบ
      ['07/07/2026', 'INV-005', '0812345678', 'พนักงานมั่ว', 1000, 0, 'S99 · ไม่มีตัวตน', ''],
      // 9: เบอร์ไม่มีในระบบ → unmatched
      ['07/07/2026', 'INV-006', '0899999999', 'ยังไม่สมัคร', 1000, 0, rep(REPS[0]), ''],
      // 10: แถวว่างคั่นกลาง
      [],
      // 11: ยอดลดหนี้ > ยอดซื้อ
      ['07/07/2026', 'INV-007', '0812345678', 'ลดเกิน', 1000, 2000, rep(REPS[0]), ''],
      // 12: ยอดน้อยจนได้ 0 แต้ม
      ['07/07/2026', 'INV-008', '0812345678', 'ยอดน้อย', 20, 0, rep(REPS[0]), ''],
      // 13: พนักงานขายถูกปิดใช้งาน
      ['07/07/2026', 'INV-009', '0812345678', 'พนักงานปิด', 1000, 0, rep(REPS[2]), ''],
      // 14: ปี 2 หลัก → ต้องไม่เดา
      ['07/07/69', 'INV-010', '0812345678', 'ปีสองหลัก', 1000, 0, rep(REPS[0]), ''],
      // 15: ยอดมีคำว่าบาท + นอกช่วง campaign (ตัวคูณ 1) → 3300/100 = 33
      ['11/07/2026', 'INV-011', '0812345678', 'มีคำว่าบาท', '3,300 บาท', '', rep(REPS[0]), ''],
    ]
    const buf = await makeWorkbook(rows)
    const r = await parseSalesBatch(buf, ctx())
    const byRow = new Map(r.rows.map((x) => [x.row_no, x]))
    const g = (n) => byRow.get(n)

    check('แถว 2 valid + campaign x2 → 100 แต้ม',
      g(2)?.status === 'valid' && g(2)?.points === 100 && g(2)?.multiplier === 2,
      JSON.stringify({ s: g(2)?.status, p: g(2)?.points, m: g(2)?.multiplier, e: g(2)?.errors }))
    check('แถว 3 เติม 0 หน้าเบอร์ + คอมม่า → 0898765432 / 105 แต้ม',
      g(3)?.status === 'valid' && g(3)?.phone === '0898765432' && g(3)?.points === 105 && g(3)?.multiplier === 1,
      JSON.stringify({ s: g(3)?.status, ph: g(3)?.phone, p: g(3)?.points, e: g(3)?.errors }))
    check('แถว 4 พ.ศ. 2569 → 2026-07-08',
      g(4)?.purchase_date === '2026-07-08' && g(4)?.status === 'valid',
      JSON.stringify({ d: g(4)?.purchase_date, e: g(4)?.errors }))
    check('แถว 5 วันที่นอกสัปดาห์ → invalid', g(5)?.status === 'invalid' && hasErr(g(5), 'อยู่นอกช่วง'),
      JSON.stringify(g(5)?.errors))
    check('แถว 6 บิลซ้ำในไฟล์ (ต่างตัวพิมพ์) → invalid', g(6)?.status === 'invalid' && hasErr(g(6), 'ซ้ำกับแถวที่ 2'),
      JSON.stringify(g(6)?.errors))
    check('แถว 7 บิลซ้ำกับ batch เก่า → invalid', g(7)?.status === 'invalid' && hasErr(g(7), 'เคยได้แต้มไปแล้ว'),
      JSON.stringify(g(7)?.errors))
    check('แถว 8 พนักงานขายไม่มีในระบบ → invalid', g(8)?.status === 'invalid' && hasErr(g(8), 'ไม่พบพนักงานขาย'),
      JSON.stringify(g(8)?.errors))
    check('แถว 9 เบอร์ไม่มีในระบบ → unmatched (ไม่ใช่ invalid)', g(9)?.status === 'unmatched',
      JSON.stringify({ s: g(9)?.status, e: g(9)?.errors }))
    check('แถวว่างถูกข้าม (ไม่มี row_no 10)', !byRow.has(10))
    check('นับแถวว่างคั่นกลาง = 1', r.summary.blank_skipped === 1, `ได้ ${r.summary.blank_skipped}`)
    check('แถว 11 ลดหนี้เกินยอดซื้อ → invalid', g(11)?.status === 'invalid' && hasErr(g(11), 'มากกว่ายอดซื้อ'),
      JSON.stringify(g(11)?.errors))
    check('แถว 12 ยอดน้อยได้ 0 แต้ม → invalid', g(12)?.status === 'invalid' && hasErr(g(12), '0 แต้ม'),
      JSON.stringify(g(12)?.errors))
    check('แถว 13 พนักงานถูกปิดใช้งาน → invalid', g(13)?.status === 'invalid' && hasErr(g(13), 'ปิดใช้งาน'),
      JSON.stringify(g(13)?.errors))
    check('แถว 14 ปี 2 หลัก → invalid ไม่เดาให้', g(14)?.status === 'invalid' && hasErr(g(14), '4 หลัก'),
      JSON.stringify(g(14)?.errors))
    check('แถว 15 "3,300 บาท" นอกช่วง campaign → 3300 / ตัวคูณ 1 / 33 แต้ม',
      g(15)?.gross === 3300 && g(15)?.multiplier === 1 && g(15)?.points === 33 && g(15)?.status === 'valid',
      JSON.stringify({ gr: g(15)?.gross, m: g(15)?.multiplier, p: g(15)?.points, e: g(15)?.errors }))

    const s = r.summary
    // 13 แถวข้อมูล (ไม่นับแถวว่าง) = valid 4 (INV-001/002/003/011) + unmatched 1 + invalid 8
    check('summary ครบถ้วน', s.total === 13 && s.valid === 4 && s.unmatched === 1 && s.invalid === 8,
      JSON.stringify(s))
    check('valid + invalid + unmatched = total', s.valid + s.invalid + s.unmatched === s.total, JSON.stringify(s))
    check('total_points = ผลรวมเฉพาะแถว valid',
      s.total_points === r.rows.filter((x) => x.status === 'valid').reduce((n, x) => n + x.points, 0),
      String(s.total_points))
  }

  // ======================================================================
  console.log('\n[3] ไฟล์ที่ต้องถูกปฏิเสธทั้งไฟล์')
  {
    const expectReject = async (label, buf, needle) => {
      try {
        await parseSalesBatch(buf, ctx())
        check(label, false, 'ไม่ throw')
      } catch (e) {
        check(label, e instanceof BatchFileError && (e.message + e.details.join(' ')).includes(needle),
          `${e.name}: ${e.message} ${JSON.stringify(e.details || [])}`)
      }
    }

    const badHeaders = [...HEADERS]
    badHeaders[1] = 'เลขบิล' // ผิดจาก "เลขที่บิล"
    await expectReject('หัวตารางผิด → ปฏิเสธ + บอกคอลัมน์',
      await makeWorkbook([], { headers: badHeaders }), 'คอลัมน์ B')

    await expectReject('มีคอลัมน์เกิน → ปฏิเสธ',
      await makeWorkbook([], { headers: [...HEADERS, 'คอลัมน์แปลก'] }), 'มีคอลัมน์เกินมา')

    await expectReject('เซลล์เป็นสูตร → ปฏิเสธ',
      await makeWorkbook(
        [['06/07/2026', 'INV-100', '0812345678', 'x', 1000, 0, rep(REPS[0]), '']],
        { mutate: (ws) => { ws.getCell('E2').value = { formula: 'SUM(1,2)', result: 3 } } }
      ), 'สูตร')

    await expectReject('แผ่นงานแปลกปลอม → ปฏิเสธ',
      await makeWorkbook([], { extraSheet: 'ชีตลับ' }), 'ชีตลับ')

    await expectReject('ไม่มีแผ่น "ยอดซื้อ" → ปฏิเสธ',
      await makeWorkbook([], { sheetName: 'คำแนะนำ' }), 'ไม่พบแผ่นงาน')

    await expectReject('แถวเกินขีดจำกัด → ปฏิเสธ',
      await makeWorkbook(
        Array.from({ length: SPEC.limits.maxDataRows + 1 }, (_, i) =>
          ['06/07/2026', 'B' + i, '0812345678', 'x', 1000, 0, rep(REPS[0]), '']),
      ), 'เกินขีดจำกัด')
  }

  // ======================================================================
  console.log('\n[4] raw_rows ตรงกับ CONTRACT ของ RPC (migration 020)')
  {
    const buf = await makeWorkbook([['06/07/2026', 'INV-200', '0812345678', 'x', 5000, 0, rep(REPS[0]), '']])
    const r = await parseSalesBatch(buf, ctx())
    const row = r.rows[0]
    const required = ['status', 'user_id', 'points', 'purchase_date', 'bill_no', 'sales_rep_id', 'gross', 'discount', 'net', 'campaign_id', 'multiplier']
    const missing = required.filter((k) => !(k in row))
    check('มีคีย์ครบตาม CONTRACT', missing.length === 0, 'ขาด: ' + missing.join(','))
    check('ค่าที่ RPC ต้องใช้ไม่เป็น null ในแถว valid',
      row.status === 'valid' && row.user_id && row.points > 0 && row.purchase_date && row.bill_no && row.sales_rep_id,
      JSON.stringify(row))
  }

  fs.rmSync(dir, { recursive: true, force: true })

  console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
  if (failures.length) {
    console.log('\nที่ตก:')
    for (const f of failures) console.log('  · ' + f)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('\nHARNESS ERROR:', e)
  process.exit(1)
})
