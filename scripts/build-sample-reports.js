/**
 * สร้างไฟล์รายงานตัวอย่าง 2 ไฟล์สำหรับส่งให้ลูกค้าดูก่อน (Sprint 9R A5)
 *
 *   node scripts/build-sample-reports.js            → จากข้อมูลสาธิต (ไม่แตะ DB)
 *   node scripts/build-sample-reports.js --from-db  → อ่าน pilot แบบ read-only (ชื่อ/เบอร์ถูกแทนด้วยค่าปลอม)
 *
 * เขียน docs/demo/sample_customers_export.xlsx และ docs/demo/sample_batch_report.xlsx
 * ใช้ builder ตัวเดียวกับ API route (src/lib/excel/build-reports.js) → ไฟล์ตัวอย่างหน้าตาเหมือนของจริงทุกอย่าง
 *
 * ⚠️ ห้ามมีชื่อ/เบอร์จริงในไฟล์ที่ commit (docs/ อยู่ใน .gitignore อยู่แล้ว แต่ไฟล์นี้ส่งให้ลูกค้า)
 *    โหมด --from-db จึงแทนชื่อ/เบอร์/รหัสด้วยค่าจำลองเสมอ เก็บไว้แค่ตัวเลข (แต้ม ยอด จำนวนบิล)
 */
const fs = require('fs')
const path = require('path')
const { buildCustomerExport, buildBatchReport, customerExportFilename, batchReportFilename } = require('../src/lib/excel/build-reports')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'demo')
const RANGE = { start: '2026-07-01', end: '2026-07-31' }
const BRANCH = 'ฮักโฮม สาขาสาธิต'

// ---- ข้อมูลสาธิต — ชื่อ/เบอร์ปลอมทั้งหมด (เบอร์ 0800000001–08 เหมือน seed_demo_data.sql) ----
const DEMO_CUSTOMERS = [
  { customer_code: 'HH-000101', first_name: 'สมชาย', last_name: 'มั่นคง', phone: '0800000001', role: 'contractor', created_at: '2026-06-02T03:00:00Z', points_balance: 25, next_expiry_points: 25, next_expiry_date: '2027-08-02', net_in_range: 2500, bills_in_range: 1, tags: ['ผู้รับเหมา', 'VIP'] },
  { customer_code: 'HH-000102', first_name: 'ปราณี', last_name: 'ศรีสุข', phone: '0800000002', role: 'homeowner', created_at: '2026-06-05T08:30:00Z', points_balance: 105, next_expiry_points: 105, next_expiry_date: '2027-08-02', net_in_range: 10500, bills_in_range: 1, tags: [] },
  { customer_code: 'HH-000103', first_name: 'ธนากร', last_name: 'ใจงาม', phone: '0800000003', role: 'contractor', created_at: '2026-06-11T02:15:00Z', points_balance: 48, next_expiry_points: 48, next_expiry_date: '2027-08-02', net_in_range: 4837, bills_in_range: 1, tags: ['ผู้รับเหมา'] },
  { customer_code: null, first_name: 'วรรณภา', last_name: 'พูนผล', phone: '0800000004', role: 'homeowner', created_at: '2026-07-01T10:00:00Z', points_balance: 9, next_expiry_points: 9, next_expiry_date: '2027-08-02', net_in_range: 850, bills_in_range: 1, tags: [] },
  { customer_code: 'HH-000105', first_name: 'อนุชา', last_name: 'แก้วใส', phone: '0800000005', role: 'contractor', created_at: '2026-06-20T06:45:00Z', points_balance: 120, next_expiry_points: 120, next_expiry_date: '2027-08-02', net_in_range: 6000, bills_in_range: 1, tags: ['ผู้รับเหมา'] },
  { customer_code: 'HH-000106', first_name: 'จันทร์เพ็ญ', last_name: 'ทองดี', phone: '0800000006', role: 'homeowner', created_at: '2026-05-15T09:00:00Z', points_balance: 300, next_expiry_points: 300, next_expiry_date: '2027-08-02', net_in_range: 15000, bills_in_range: 1, tags: ['VIP'] },
  { customer_code: 'HH-000107', first_name: 'ประเสริฐ', last_name: 'วงศ์ไทย', phone: '0800000007', role: 'contractor', created_at: '2026-04-28T04:20:00Z', points_balance: 60, next_expiry_points: 60, next_expiry_date: '2027-08-02', net_in_range: 3000, bills_in_range: 1, tags: [] },
  { customer_code: 'HH-000108', first_name: 'มาลี', last_name: 'บุญมาก', phone: '0800000008', role: 'homeowner', created_at: '2026-07-10T12:00:00Z', points_balance: 20, next_expiry_points: 20, next_expiry_date: '2027-08-02', net_in_range: 990, bills_in_range: 1, tags: [] },
  { customer_code: 'HH-000109', first_name: 'ลูกค้า', last_name: 'ยังไม่ซื้อ', phone: '0800000009', role: 'homeowner', created_at: '2026-07-20T05:00:00Z', points_balance: 0, next_expiry_points: null, next_expiry_date: null, net_in_range: 0, bills_in_range: 0, tags: [] },
]

const DEMO_BATCH = {
  file_name: 'demo-ยอดขาย-2026-07-20_2026-07-26.xlsx',
  week_start: '2026-07-20',
  week_end: '2026-07-26',
  status: 'committed',
  uploaded_by_name: 'บัญชี (สาธิต)',
  submitted_by_name: 'บัญชี (สาธิต)',
  committed_by_name: 'ผู้อนุมัติ (สาธิต)',
  committed_at: '2026-08-02T02:00:00Z',
  voided_by_name: null,
  void_reason: null,
}
const R = (code, name) => `${code} · ${name}`
const DEMO_ROWS = [
  { purchase_date: '2026-07-20', bill_no: 'DM-2607-001', customer_code: 'HH-000101', phone: '0800000001', customer_name: 'สมชาย มั่นคง', gross: 2500, discount: 0, net: 2500, multiplier: 1, points: 25, sales_rep: R('S01', 'สมชาย มั่นคง') },
  { purchase_date: '2026-07-20', bill_no: 'DM-2607-002', customer_code: 'HH-000102', phone: '0800000002', customer_name: 'ปราณี ศรีสุข', gross: 12000, discount: 1500, net: 10500, multiplier: 1, points: 105, sales_rep: R('S02', 'ปราณี ศรีสุข') },
  { purchase_date: '2026-07-21', bill_no: 'DM-2607-003', customer_code: 'HH-000103', phone: '0800000003', customer_name: 'ธนากร ใจงาม', gross: 4837, discount: 0, net: 4837, multiplier: 1, points: 48, sales_rep: R('S01', 'สมชาย มั่นคง') },
  { purchase_date: '2026-07-22', bill_no: 'DM-2607-004', customer_code: null, phone: '0800000004', customer_name: 'วรรณภา พูนผล', gross: 850, discount: 0, net: 850, multiplier: 1, points: 9, sales_rep: R('S03', 'ธนากร ใจงาม') },
  { purchase_date: '2026-07-23', bill_no: 'DM-2607-005', customer_code: 'HH-000105', phone: '0800000005', customer_name: 'อนุชา แก้วใส', gross: 6000, discount: 0, net: 6000, multiplier: 2, points: 120, sales_rep: R('S02', 'ปราณี ศรีสุข') },
  { purchase_date: '2026-07-24', bill_no: 'DM-2607-006', customer_code: 'HH-000106', phone: '0800000006', customer_name: 'จันทร์เพ็ญ ทองดี', gross: 15750, discount: 750, net: 15000, multiplier: 2, points: 300, sales_rep: R('S04', 'จันทร์เพ็ญ ทองดี') },
  { purchase_date: '2026-07-25', bill_no: 'DM-2607-007', customer_code: 'HH-000107', phone: '0800000007', customer_name: 'ประเสริฐ วงศ์ไทย', gross: 3300, discount: 300, net: 3000, multiplier: 2, points: 60, sales_rep: R('S03', 'ธนากร ใจงาม') },
  { purchase_date: '2026-07-26', bill_no: 'DM-2607-008', customer_code: 'HH-000108', phone: '0800000008', customer_name: 'มาลี บุญมาก', gross: 990, discount: 0, net: 990, multiplier: 2, points: 20, sales_rep: R('S04', 'จันทร์เพ็ญ ทองดี') },
]

/** โหมด --from-db: ตัวเลขจริง ชื่อ/เบอร์/รหัสจำลอง (อ่านอย่างเดียว) */
async function loadFromDb() {
  require('dotenv').config({ path: path.join(ROOT, '.env.local'), quiet: true })
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('--from-db ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: users, error: uErr } = await sb
    .from('user_profiles')
    .select('id, role, created_at, points_balance')
    .not('role', 'is', null)
    .order('created_at', { ascending: true })
    .limit(50)
  if (uErr) throw new Error('อ่าน user_profiles ไม่ได้: ' + uErr.message)

  const { data: lots, error: lErr } = await sb
    .from('point_batch_ledger')
    .select('user_id, net_amount, purchase_date, points_remaining, expires_at, voided')
    .limit(1000)
  if (lErr) throw new Error('อ่าน point_batch_ledger ไม่ได้: ' + lErr.message)

  const customers = (users ?? []).map((u, i) => {
    const mine = (lots ?? []).filter((l) => l.user_id === u.id)
    const inRange = mine.filter((l) => !l.voided && l.purchase_date >= RANGE.start && l.purchase_date <= RANGE.end)
    const live = mine.filter((l) => l.points_remaining > 0).sort((a, b) => (a.expires_at < b.expires_at ? -1 : 1))
    const next = live[0]
    return {
      customer_code: i % 4 === 3 ? null : `HH-${String(100 + i).padStart(6, '0')}`,
      first_name: `ลูกค้า${i + 1}`,
      last_name: 'ตัวอย่าง',
      phone: `08000000${String(i + 1).padStart(2, '0')}`,
      role: u.role,
      created_at: u.created_at,
      points_balance: u.points_balance ?? 0,
      next_expiry_points: next ? live.filter((l) => l.expires_at === next.expires_at).reduce((n, l) => n + l.points_remaining, 0) : null,
      next_expiry_date: next?.expires_at ?? null,
      net_in_range: inRange.reduce((n, l) => n + Number(l.net_amount ?? 0), 0),
      bills_in_range: inRange.length,
      tags: [],
    }
  })

  const { data: batch } = await sb
    .from('point_batches')
    .select('file_name, week_start, week_end, status, raw_rows, committed_at')
    .eq('status', 'committed')
    .order('committed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!batch) return { customers, batch: DEMO_BATCH, rows: DEMO_ROWS }

  const rows = (batch.raw_rows ?? [])
    .filter((r) => r.status === 'valid' || r.status === 'duplicate_amount')
    .map((r, i) => ({
      purchase_date: r.purchase_date,
      bill_no: `BILL-${String(i + 1).padStart(4, '0')}`,
      customer_code: `HH-${String(100 + i).padStart(6, '0')}`,
      phone: `08000000${String((i % 9) + 1).padStart(2, '0')}`,
      customer_name: `ลูกค้า${i + 1} ตัวอย่าง`,
      gross: r.gross,
      discount: r.discount,
      net: r.net,
      multiplier: r.multiplier,
      points: r.points,
      sales_rep: r.sales_rep_code ? `${r.sales_rep_code} · Maker ตัวอย่าง` : null,
    }))
  return {
    customers,
    batch: { ...DEMO_BATCH, file_name: batch.file_name, week_start: batch.week_start, week_end: batch.week_end, committed_at: batch.committed_at },
    rows,
  }
}

async function main() {
  const fromDb = process.argv.includes('--from-db')
  const data = fromDb ? await loadFromDb() : { customers: DEMO_CUSTOMERS, batch: DEMO_BATCH, rows: DEMO_ROWS }

  fs.mkdirSync(OUT_DIR, { recursive: true })

  const wb1 = buildCustomerExport({ rangeStart: RANGE.start, rangeEnd: RANGE.end, customers: data.customers })
  const f1 = path.join(OUT_DIR, 'sample_customers_export.xlsx')
  await wb1.xlsx.writeFile(f1)

  const wb2 = buildBatchReport({ branchName: BRANCH, batch: data.batch, rows: data.rows })
  const f2 = path.join(OUT_DIR, 'sample_batch_report.xlsx')
  await wb2.xlsx.writeFile(f2)

  console.log(`written: ${f1}  (ชื่อจริงตอนดาวน์โหลด: ${customerExportFilename(RANGE.start, RANGE.end)})`)
  console.log(`written: ${f2}  (ชื่อจริงตอนดาวน์โหลด: ${batchReportFilename(data.batch)})`)
  console.log(`source: ${fromDb ? 'pilot DB (read-only · ชื่อ/เบอร์/รหัสจำลอง)' : 'demo data'}`)
  console.log(`customers: ${data.customers.length} · batch rows: ${data.rows.length}`)
}

main().catch((e) => {
  console.error('\n' + e.message + '\n')
  process.exit(1)
})
