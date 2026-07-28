/**
 * Self-check ของชุด demo — รัน parser จริงกับไฟล์ใน docs/demo/ แล้วเทียบกับที่คิดมือไว้
 *
 *   node scripts/build-demo-batch.js && node scripts/verify-demo-batch.js
 *
 * context (พนักงาน/แคมเปญ/ลูกค้า) จำลองจาก supabase/seed/seed_demo_data.sql
 * → ถ้าสคริปต์นี้ผ่าน แปลว่าพอ seed ขึ้น DB จริงแล้วอัปโหลดจะได้ผลแบบเดียวกัน
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOT = path.join(__dirname, '..')
const DEMO_DIR = path.join(ROOT, 'docs', 'demo')
const SPEC = require('../src/lib/excel/sales-columns.json')

function loadParser() {
  fs.mkdirSync(path.join(ROOT, 'node_modules', '.cache'), { recursive: true })
  const out = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.cache', 'demoparse-'))
  const emit = (rel, dest, rw = (s) => s) => {
    const js = ts.transpileModule(fs.readFileSync(path.join(ROOT, rel), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
    fs.writeFileSync(path.join(out, dest), rw(js))
  }
  emit('src/lib/phone.ts', 'phone.mjs')
  emit('src/lib/excel/parse-sales-batch.ts', 'parser.mjs', (js) =>
    js
      .replace(/from ['"]@\/lib\/phone['"]/g, "from './phone.mjs'")
      .replace(/import\s+SPEC\s+from\s+['"]\.\/sales-columns\.json['"];?/, `const SPEC = ${JSON.stringify(SPEC)};`)
  )
  return out
}

// ---- จำลอง seed_demo_data.sql ----
const SALES_REPS = ['S01', 'S02', 'S03', 'S04'].map((code, i) => ({
  id: `rep-${i + 1}`,
  code,
  full_name: ['สมชาย มั่นคง', 'ปราณี ศรีสุข', 'ธนากร ใจงาม', 'จันทร์เพ็ญ ทองดี'][i],
  is_active: true,
}))
const CAMPAIGNS = [
  { id: 'camp-1', name: 'ต้นฤดูฝน รับแต้ม 1.5 เท่า', multiplier: 1.5, starts_on: '2026-06-01', ends_on: '2026-06-30' },
  { id: 'camp-2', name: 'ฮักโฮมกลางปี รับแต้ม 2 เท่า', multiplier: 2, starts_on: '2026-07-23', ends_on: '2026-08-05' },
]
const USERS = new Map(
  Array.from({ length: 8 }, (_, i) => [`080000000${i + 1}`, `demo-user-${i + 1}`])
)

let pass = 0
const failures = []
const check = (label, cond, detail) => {
  if (cond) {
    pass++
    console.log('  ✅ ' + label)
  } else {
    failures.push(label + (detail ? ` — ${detail}` : ''))
    console.log('  ❌ ' + label + (detail ? ` — ${detail}` : ''))
  }
}

async function main() {
  const expectedPath = path.join(DEMO_DIR, 'expected.json')
  if (!fs.existsSync(expectedPath)) {
    throw new Error('ไม่พบ docs/demo/expected.json — รัน node scripts/build-demo-batch.js ก่อน')
  }
  const EXPECT = JSON.parse(fs.readFileSync(expectedPath, 'utf8'))

  const xlsx = fs.readdirSync(DEMO_DIR).find((f) => f.endsWith('.xlsx'))
  if (!xlsx) throw new Error('ไม่พบไฟล์ .xlsx ใน docs/demo/')
  console.log('ไฟล์:', xlsx)
  console.log('สัปดาห์:', EXPECT.week.start, '→', EXPECT.week.end, '\n')

  const dir = loadParser()
  const { parseSalesBatch } = await import(path.join(dir, 'parser.mjs'))

  const result = await parseSalesBatch(fs.readFileSync(path.join(DEMO_DIR, xlsx)), {
    weekStart: EXPECT.week.start,
    weekEnd: EXPECT.week.end,
    bahtPerPoint: 100,
    salesReps: SALES_REPS,
    activeCampaigns: CAMPAIGNS,
    usersByPhone: USERS,
    billsInUse: new Map(),
  })

  // ---------------- ตารางผลจริง ----------------
  console.log('ผลจาก parser:')
  console.log('  แถว  เลขบิล        วันที่ซื้อ    สุทธิ   ตัวคูณ  แต้ม  สถานะ')
  for (const r of result.rows) {
    console.log(
      `  ${String(r.row_no).padStart(3)}  ${(r.bill_no ?? '—').padEnd(13)} ${(r.purchase_date ?? '—').padEnd(11)} ` +
        `${String(r.net ?? '—').padStart(6)}  ${String(r.multiplier).padStart(4)}  ${String(r.points ?? '—').padStart(4)}  ` +
        `${r.status}${r.errors.length ? ' · ' + r.errors.join(' / ') : ''}`
    )
  }

  const s = result.summary
  console.log(
    `\nสรุป: ทั้งหมด ${s.total} · ใช้ได้ ${s.valid} · ผิดพลาด ${s.invalid} · ไม่พบลูกค้า ${s.unmatched} · รวม ${s.total_points} แต้ม\n`
  )

  // ---------------- assert ----------------
  console.log('[เทียบกับที่ตั้งใจไว้]')
  check('ทั้งหมด 10 แถว', s.total === 10, String(s.total))
  check('ใช้ได้ 8 แถว', s.valid === 8, String(s.valid))
  check('ไม่พบลูกค้า 1 แถว (เบอร์ 0899999999)', s.unmatched === 1, String(s.unmatched))
  check('ผิดพลาด 1 แถว (ลดหนี้เกินยอดซื้อ)', s.invalid === 1, String(s.invalid))
  check('รวมแต้ม = 687 (ตรงกับที่คิดมือ)', s.total_points === EXPECT.totalPoints && s.total_points === 687, String(s.total_points))

  console.log('\n[เทียบแต้มรายแถว: parser vs คิดมือ]')
  const byBill = new Map(result.rows.map((r) => [r.bill_no, r]))
  for (const e of EXPECT.expected) {
    const got = byBill.get(e.bill)
    if (e.points === null) {
      check(`${e.bill} ต้องไม่ผ่าน (${e.note.replace('❌ ', '')})`, got && got.status !== 'valid', got?.status)
    } else {
      check(
        `${e.bill} → ${e.points} แต้ม (×${e.mult})`,
        got?.points === e.points && Number(got?.multiplier) === e.mult && got?.status === 'valid',
        `parser: ${got?.points} แต้ม ×${got?.multiplier} (${got?.status})`
      )
    }
  }

  // ---------------- คิดมือละเอียด 1 แถวในแคมเปญ ----------------
  console.log('\n[คิดมือทีละขั้น: DM-2607-006 ในช่วงแคมเปญ x2]')
  const r6 = byBill.get('DM-2607-006')
  const gross = 15750
  const discount = 750
  const net = gross - discount // 15000
  const base = net / 100 // 150
  const withMult = base * 2 // 300
  const rounded = Math.round(withMult) // 300
  console.log(`  ยอดซื้อ ${gross} − ลดหนี้ ${discount} = สุทธิ ${net}`)
  console.log(`  ${net} ÷ 100 บาท/แต้ม = ${base}`)
  console.log(`  วันที่ซื้อ 2026-07-24 อยู่ใน 2026-07-23 → 2026-08-05 จึงได้ตัวคูณ 2`)
  console.log(`  ${base} × 2 = ${withMult} → ปัดเศษ = ${rounded} แต้ม`)
  console.log(`  parser คิดได้ = ${r6?.points} แต้ม (แคมเปญ: ${r6?.campaign_name})`)
  check('คิดมือตรงกับ parser', r6?.points === rounded, `มือ ${rounded} vs parser ${r6?.points}`)
  check('จับแคมเปญถูกตัว', r6?.campaign_name === 'ฮักโฮมกลางปี รับแต้ม 2 เท่า', String(r6?.campaign_name))

  fs.rmSync(dir, { recursive: true, force: true })

  console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
  if (failures.length) {
    console.log('\nที่ตก:')
    failures.forEach((f) => console.log('  · ' + f))
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('\nERROR:', e.message)
  process.exit(1)
})
