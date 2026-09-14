/**
 * ทดสอบเส้นทางเงินจริงบน Supabase: parse → preview → commit → void → คีย์บิลซ้ำหลัง void
 *
 *   node scripts/e2e-batch-flow.js
 *
 * ⚠️ เขียนลง DB จริง แต่สร้าง "ลูกค้าทดสอบของตัวเอง" (line_user_id ขึ้นต้น E2E-TEST-)
 *    ไม่แตะบัญชีลูกค้าจริงเลย และลบทุกอย่างที่สร้างทิ้งตอนจบ (รวมกรณี error)
 *
 * ทำไมต้องมี: RPC award_points_from_batch v3 (migration 020) ยังไม่เคยถูกรันสักครั้ง
 * parse ผ่าน + build ผ่าน ไม่ได้แปลว่า plpgsql ข้างในทำงานถูก
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const ExcelJS = require('exceljs')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..')
const SPEC = require('../src/lib/excel/sales-columns.json')
const HEADERS = SPEC.columns.map((c) => c.header)
const TAG = 'E2E-TEST-' + Date.now()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

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

// transpile parser (เหมือน scripts/test-parse-sales-batch.js)
function loadParser() {
  fs.mkdirSync(path.join(ROOT, 'node_modules', '.cache'), { recursive: true })
  const out = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.cache', 'e2eparse-'))
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

async function makeSheet(rows) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(SPEC.sheetName)
  ws.addRow(HEADERS)
  rows.forEach((r) => ws.addRow(r))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

const created = { batches: [], users: [], reps: [] }

async function cleanup() {
  console.log('\n🧹 ลบข้อมูลทดสอบ')
  for (const b of created.batches) {
    await sb.from('point_transactions').delete().eq('source_batch_id', b)
    await sb.from('point_batch_ledger').delete().eq('source_batch_id', b)
    await sb.from('point_batches').delete().eq('id', b)
  }
  for (const u of created.users) {
    await sb.from('point_transactions').delete().eq('user_id', u)
    await sb.from('point_batch_ledger').delete().eq('user_id', u)
    await sb.from('user_profiles').delete().eq('id', u)
  }
  for (const r of created.reps) await sb.from('sales_reps').delete().eq('id', r)

  const leftovers = await Promise.all([
    sb.from('user_profiles').select('id').like('line_user_id', TAG + '%'),
    sb.from('sales_reps').select('id').like('code', 'E2E%'),
    sb.from('point_batches').select('id').like('file_name', 'e2e-%'),
  ])
  const n = leftovers.reduce((s, r) => s + (r.data?.length ?? 0), 0)
  console.log(n === 0 ? '   ✅ ไม่เหลือข้อมูลทดสอบใน DB' : `   ⚠️ ยังเหลือ ${n} แถว — ตรวจด้วยมือ`)
}

async function main() {
  const dir = loadParser()
  const { parseSalesBatch } = await import(path.join(dir, 'parser.mjs'))

  const { data: admin } = await sb.from('admin_users').select('id').eq('is_active', true).limit(1).single()
  if (!admin) throw new Error('ไม่มี admin_users ที่ active — ทดสอบไม่ได้')

  // ---------- ตั้งข้อมูลทดสอบ ----------
  console.log('\n[setup] สร้างพนักงานขาย + ลูกค้าทดสอบ')
  const { data: rep, error: repErr } = await sb
    .from('sales_reps')
    .insert({ code: 'E2E01', full_name: 'พนักงานทดสอบ E2E', created_by: admin.id })
    .select()
    .single()
  if (repErr) throw new Error('สร้าง sales_rep ไม่ได้: ' + repErr.message)
  created.reps.push(rep.id)

  // เบอร์สุ่มไม่ชนลูกค้าสาธิต (seed ใช้ 0800000001–08) · ลบทิ้งตอนจบ
  const phone = '09' + String(Date.now()).slice(-8)
  const { data: user, error: userErr } = await sb
    .from('user_profiles')
    .insert({
      line_user_id: TAG + '-user',
      phone,
      birthday: '1990-01-01',
      first_name: 'ลูกค้า',
      last_name: 'ทดสอบ E2E',
      role: 'contractor',
    })
    .select()
    .single()
  if (userErr) throw new Error('สร้าง user ไม่ได้: ' + userErr.message)
  created.users.push(user.id)
  check('ลูกค้าทดสอบเริ่มต้นที่ 0 แต้ม', user.points_balance === 0, String(user.points_balance))

  // ---------- parse ----------
  // วันที่ซื้อ = พฤษภาคม (คนละเดือนกับตอน commit) → พิสูจน์ว่า earned_month ยึดวันที่ซื้อ
  // ใช้เดือนที่ไม่มีแคมเปญใน seed (มิ.ย. มี ×1.5) — สคริปต์นี้ส่ง activeCampaigns ว่าง จึงต้องเป็น ×1 จริง
  console.log('\n[1] parse ไฟล์ (ซื้อ พ.ค. · commit วันนี้)')
  const BILL = 'E2E-BILL-001'
  const buf = await makeSheet([
    ['15/05/2026', BILL, phone, 'ลูกค้าทดสอบ', 5000, 500, `${rep.code}${SPEC.salesRepSeparator}${rep.full_name}`, 'e2e'],
  ])
  const ctx = {
    weekStart: '2026-05-11',
    weekEnd: '2026-05-17',
    bahtPerPoint: 100,
    salesReps: [rep],
    activeCampaigns: [],
    usersByPhone: new Map([[phone, user.id]]),
    billsInUse: new Map(),
  }
  const parsed = await parseSalesBatch(buf, ctx)
  check('parse ได้ 1 แถว valid', parsed.summary.valid === 1, JSON.stringify(parsed.summary))
  check('คิดแต้ม (5000-500)/100 = 45', parsed.rows[0].points === 45, String(parsed.rows[0].points))

  // ---------- preview → commit ----------
  console.log('\n[2] commit → แต้มเข้าจริง')
  const mkBatch = async (name) => {
    const { data, error } = await sb
      .from('point_batches')
      .insert({
        uploaded_by: admin.id,
        file_name: name,
        file_sha256: TAG + '-' + name,
        week_start: ctx.weekStart,
        week_end: ctx.weekEnd,
        status: 'previewed',
        total_rows: parsed.summary.total,
        valid_rows: parsed.summary.valid,
        invalid_rows: parsed.summary.invalid,
        unmatched_rows: parsed.summary.unmatched,
        total_points: parsed.summary.total_points,
        raw_rows: parsed.rows,
      })
      .select('id')
      .single()
    if (error) throw new Error('สร้าง batch ไม่ได้: ' + error.message)
    created.batches.push(data.id)
    return data.id
  }

  const batch1 = await mkBatch('e2e-1.xlsx')
  const { data: awarded, error: awardErr } = await sb.rpc('award_points_from_batch', {
    p_batch_id: batch1,
    p_admin: admin.id,
  })
  check('RPC award สำเร็จ', !awardErr, awardErr?.message)
  check('คืนค่าแต้มรวม = 45', awarded === 45, String(awarded))

  const after = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('ยอดแต้มลูกค้าขึ้นเป็น 45', after.data?.points_balance === 45, String(after.data?.points_balance))

  const lot = await sb
    .from('point_batch_ledger')
    .select('*')
    .eq('source_batch_id', batch1)
    .single()
  check('earned_month = 2026-05-01 (เดือนที่ซื้อ ไม่ใช่เดือนที่ commit)',
    lot.data?.earned_month === '2026-05-01', String(lot.data?.earned_month))
  check('expires_at = 2027-05-31 (สิ้นเดือน พ.ค. + 365)',
    lot.data?.expires_at === '2027-05-31', String(lot.data?.expires_at))
  check('เก็บ bill_no', lot.data?.bill_no === BILL, String(lot.data?.bill_no))
  check('เก็บ sales_rep_id', lot.data?.sales_rep_id === rep.id, String(lot.data?.sales_rep_id))
  check('เก็บ purchase_date', lot.data?.purchase_date === '2026-05-15', String(lot.data?.purchase_date))
  check('voided = false', lot.data?.voided === false, String(lot.data?.voided))

  const bat = await sb.from('point_batches').select('status, committed_by, committed_at').eq('id', batch1).single()
  check('batch status = committed', bat.data?.status === 'committed', String(bat.data?.status))
  check('committed_by = admin ที่กด', bat.data?.committed_by === admin.id, String(bat.data?.committed_by))

  const tx = await sb.from('point_transactions').select('*').eq('source_batch_id', batch1).eq('type', 'earned').single()
  check('point_transactions.created_by = admin (เดิมเป็น NULL)', tx.data?.created_by === admin.id, String(tx.data?.created_by))

  // ---------- บิลซ้ำ ----------
  console.log('\n[3] คีย์บิลเดิมซ้ำ → ต้องถูกเตะ')
  const batch2 = await mkBatch('e2e-2.xlsx')
  const dup = await sb.rpc('award_points_from_batch', { p_batch_id: batch2, p_admin: admin.id })
  check('RPC ปฏิเสธบิลซ้ำ', !!dup.error && dup.error.code === '23505',
    dup.error ? `${dup.error.code}: ${dup.error.message.slice(0, 80)}` : 'ไม่ error')
  const afterDup = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มไม่เพิ่ม (rollback ทั้ง batch)', afterDup.data?.points_balance === 45, String(afterDup.data?.points_balance))

  // ---------- void ----------
  console.log('\n[4] void → คืนแต้ม + ปลดล็อกเลขบิล')
  const v = await sb.rpc('void_batch', { p_batch_id: batch1, p_admin: admin.id, p_reason: 'e2e test' })
  check('RPC void สำเร็จ', !v.error, v.error?.message)
  const afterVoid = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มกลับเป็น 0', afterVoid.data?.points_balance === 0, String(afterVoid.data?.points_balance))
  const lotVoided = await sb.from('point_batch_ledger').select('voided, points_remaining').eq('source_batch_id', batch1).single()
  check('ledger ถูกมาร์ค voided', lotVoided.data?.voided === true, String(lotVoided.data?.voided))

  // ---------- คีย์บิลเดิมใหม่หลัง void ----------
  console.log('\n[5] คีย์บิลเดิมใหม่หลัง void → ต้องผ่าน')
  const redo = await sb.rpc('award_points_from_batch', { p_batch_id: batch2, p_admin: admin.id })
  check('RPC ยอมรับบิลเดิมหลัง void', !redo.error, redo.error?.message)
  const afterRedo = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มขึ้นใหม่เป็น 45', afterRedo.data?.points_balance === 45, String(afterRedo.data?.points_balance))

  // ---------- invariant ----------
  console.log('\n[6] invariant: points_balance == SUM(ledger.points_remaining)')
  const lots = await sb.from('point_batch_ledger').select('points_remaining').eq('user_id', user.id)
  const sum = (lots.data ?? []).reduce((n, l) => n + l.points_remaining, 0)
  const bal = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('ยอดตรงกับผลรวม ledger', bal.data?.points_balance === sum, `balance=${bal.data?.points_balance} sum=${sum}`)
}

main()
  .then(cleanup, async (e) => {
    console.error('\nERROR:', e.message)
    failures.push('exception: ' + e.message)
    await cleanup()
  })
  .then(() => {
    console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
    if (failures.length) {
      console.log('\nที่ตก:')
      failures.forEach((f) => console.log('  · ' + f))
      process.exit(1)
    }
  })
