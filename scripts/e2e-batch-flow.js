/**
 * ทดสอบเส้นทางเงินจริงบน Supabase (Sprint 9R · migration 024/025):
 *   parse → previewed → (RPC ปฏิเสธ previewed) → submit (pending_approval) → approve (RPC)
 *   → บิลซ้ำโดนเตะ → void (Rollback) → คีย์บิลเดิมใหม่ผ่าน → ปฏิเสธชุด pending_approval → invariant
 *
 *   node scripts/e2e-batch-flow.js
 *
 * ⚠️ เขียนลง DB จริง แต่สร้าง "ลูกค้าทดสอบของตัวเอง" (line_user_id ขึ้นต้น E2E-TEST-)
 *    ไม่แตะบัญชีลูกค้าจริงเลย และลบทุกอย่างที่สร้างทิ้งตอนจบ (รวมกรณี error)
 * ⚠️ ต้อง apply 024 + 025 ก่อน — ไม่งั้นข้อ [2] จะตกที่ "must be previewed"
 *
 * ทำไมต้องมี: parse ผ่าน + build ผ่าน ไม่ได้แปลว่า plpgsql ข้างในทำงานถูก
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
  // วันที่ซื้อ = พฤษภาคม (คนละเดือนกับตอนอนุมัติ) → พิสูจน์ว่า 025 ยึด "วันที่อนุมัติ" ไม่ใช่วันที่ซื้อ (Q4)
  // ใช้เดือนที่ไม่มีแคมเปญใน seed (มิ.ย. มี ×1.5) — สคริปต์นี้ส่ง activeCampaigns ว่าง จึงต้องเป็น ×1 จริง
  console.log('\n[1] parse ไฟล์ v2 (ซื้อ พ.ค. · อนุมัติวันนี้)')
  const BILL = 'E2E-BILL-001'
  const repLabel = `${rep.code}${SPEC.salesRepSeparator}${rep.full_name}`
  const buf = await makeSheet([
    // รหัสลูกค้า | วันที่ | บิล | เบอร์ | ชื่อ | ยอด | ลด | Maker | หมายเหตุ
    ['', '15/05/2026', BILL, phone, 'ลูกค้าทดสอบ', 5000, 500, repLabel, 'e2e'],
    // ยอดซ้ำ (เบอร์+วัน+สุทธิ เท่ากัน คนละบิล) → duplicate_amount ต้องได้แต้มเหมือน valid
    ['', '15/05/2026', 'E2E-BILL-DUP', phone, 'ลูกค้าทดสอบ', 5000, 500, repLabel, 'e2e dup'],
  ])
  const ctx = {
    weekStart: '2026-05-11',
    weekEnd: '2026-05-17',
    bahtPerPoint: 100,
    salesReps: [rep],
    activeCampaigns: [],
    usersByPhone: new Map([[phone, user.id]]),
    customerCodeByUserId: new Map([[user.id, null]]),
    billsInUse: new Map(),
  }
  const parsed = await parseSalesBatch(buf, ctx)
  check('parse ได้ valid 1 + duplicate_amount 1', parsed.summary.valid === 1 && parsed.summary.duplicate_amount === 1, JSON.stringify(parsed.summary))
  check('คิดแต้ม (5000-500)/100 = 45 ต่อแถว · รวม 90', parsed.rows[0].points === 45 && parsed.summary.total_points === 90, String(parsed.summary.total_points))

  // ---------- preview → submit → approve ----------
  console.log('\n[2] previewed ตรง ๆ ต้องอนุมัติไม่ได้ → submit → approve → แต้มเข้าจริง')
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
        valid_rows: parsed.summary.valid + parsed.summary.duplicate_amount,
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

  /** จำลอง POST /:id/submit — UPDATE แบบมี guard status เดิม (route ทำแบบเดียวกัน) */
  const submitBatch = async (id) => {
    const { data, error } = await sb
      .from('point_batches')
      .update({ status: 'pending_approval', submitted_by: admin.id, submitted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'previewed')
      .select('id, status')
      .maybeSingle()
    if (error) throw new Error('submit ไม่ได้: ' + error.message)
    return data
  }

  const batch1 = await mkBatch('e2e-1.xlsx')
  const early = await sb.rpc('award_points_from_batch', { p_batch_id: batch1, p_admin: admin.id })
  check('RPC ปฏิเสธชุด previewed (ต้อง submit ก่อน · ไม่มี auto-approve)',
    !!early.error && early.error.message.includes('must be pending_approval'), early.error?.message ?? 'ไม่ error')
  const stillZero = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มยังเป็น 0 หลังถูกปฏิเสธ', stillZero.data?.points_balance === 0, String(stillZero.data?.points_balance))

  const sub = await submitBatch(batch1)
  check('submit: previewed → pending_approval', sub?.status === 'pending_approval', String(sub?.status))
  const subAgain = await submitBatch(batch1)
  check('submit ซ้ำ → 0 แถว (guard status เดิม)', subAgain === null, JSON.stringify(subAgain))

  const { data: awarded, error: awardErr } = await sb.rpc('award_points_from_batch', {
    p_batch_id: batch1,
    p_admin: admin.id,
  })
  check('RPC award (อนุมัติ) สำเร็จ', !awardErr, awardErr?.message)
  check('คืนค่าแต้มรวม = 90 (valid 45 + duplicate_amount 45)', awarded === 90, String(awarded))

  const after = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('ยอดแต้มลูกค้าขึ้นเป็น 90', after.data?.points_balance === 90, String(after.data?.points_balance))

  const lots1 = await sb.from('point_batch_ledger').select('*').eq('source_batch_id', batch1).order('bill_no')
  check('ledger 2 lot (แถว duplicate_amount ได้แต้มด้วย)', lots1.data?.length === 2, String(lots1.data?.length))
  const lot = { data: (lots1.data ?? []).find((l) => l.bill_no === BILL) }

  // 025 (Q4): ฐานอายุแต้ม = วันที่อนุมัติตามเวลาไทย · ไม่ใช่เดือนที่ซื้อ
  const todayBkk = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  const expectedEarnedMonth = todayBkk.slice(0, 7) + '-01'
  const expectedExpiry = new Date(Date.UTC(+todayBkk.slice(0, 4), +todayBkk.slice(5, 7) - 1, +todayBkk.slice(8, 10) + 365)).toISOString().slice(0, 10)
  check(`earned_month = ${expectedEarnedMonth} (เดือนที่อนุมัติ ไม่ใช่เดือนที่ซื้อ พ.ค.)`,
    lot.data?.earned_month === expectedEarnedMonth, String(lot.data?.earned_month))
  check(`expires_at = ${expectedExpiry} (วันที่อนุมัติ + 365)`,
    lot.data?.expires_at === expectedExpiry, String(lot.data?.expires_at))
  check('เก็บ bill_no', lot.data?.bill_no === BILL, String(lot.data?.bill_no))
  check('เก็บ sales_rep_id', lot.data?.sales_rep_id === rep.id, String(lot.data?.sales_rep_id))
  check('เก็บ purchase_date (ยังเป็นวันที่ซื้อจริง)', lot.data?.purchase_date === '2026-05-15', String(lot.data?.purchase_date))
  check('voided = false', lot.data?.voided === false, String(lot.data?.voided))

  const bat = await sb.from('point_batches').select('status, committed_by, committed_at, submitted_by, submitted_at').eq('id', batch1).single()
  check('batch status = committed', bat.data?.status === 'committed', String(bat.data?.status))
  check('committed_by = ผู้อนุมัติ', bat.data?.committed_by === admin.id, String(bat.data?.committed_by))
  check('submitted_by/at ยังอยู่ (คนส่ง ≠ ช่องคนอนุมัติ)', bat.data?.submitted_by === admin.id && !!bat.data?.submitted_at, JSON.stringify(bat.data))

  const tx = await sb.from('point_transactions').select('*').eq('source_batch_id', batch1).eq('type', 'earned')
  check('point_transactions 2 แถว · created_by = ผู้อนุมัติ',
    tx.data?.length === 2 && tx.data.every((t) => t.created_by === admin.id), JSON.stringify(tx.data?.map((t) => t.created_by)))

  // ---------- บิลซ้ำ ----------
  console.log('\n[3] คีย์บิลเดิมซ้ำ → ต้องถูกเตะ')
  const batch2 = await mkBatch('e2e-2.xlsx')
  await submitBatch(batch2)
  const dup = await sb.rpc('award_points_from_batch', { p_batch_id: batch2, p_admin: admin.id })
  check('RPC ปฏิเสธบิลซ้ำ', !!dup.error && dup.error.code === '23505',
    dup.error ? `${dup.error.code}: ${dup.error.message.slice(0, 80)}` : 'ไม่ error')
  const afterDup = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มไม่เพิ่ม (rollback ทั้ง batch)', afterDup.data?.points_balance === 90, String(afterDup.data?.points_balance))
  const bat2 = await sb.from('point_batches').select('status').eq('id', batch2).single()
  check('batch2 ยังค้าง pending_approval (ไม่ถูกเปลี่ยนสถานะเมื่อ RPC ล้ม)', bat2.data?.status === 'pending_approval', String(bat2.data?.status))

  // ---------- void (Rollback) ----------
  console.log('\n[4] void ชุดที่แต้มเข้าแล้ว → คืนแต้ม + ปลดล็อกเลขบิล')
  const v = await sb.rpc('void_batch', { p_batch_id: batch1, p_admin: admin.id, p_reason: 'e2e test' })
  check('RPC void สำเร็จ', !v.error, v.error?.message)
  const afterVoid = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มกลับเป็น 0', afterVoid.data?.points_balance === 0, String(afterVoid.data?.points_balance))
  const lotVoided = await sb.from('point_batch_ledger').select('voided, points_remaining').eq('source_batch_id', batch1)
  check('ledger ทุก lot ถูกมาร์ค voided', (lotVoided.data ?? []).length === 2 && lotVoided.data.every((l) => l.voided === true), JSON.stringify(lotVoided.data))

  // ---------- คีย์บิลเดิมใหม่หลัง void ----------
  console.log('\n[5] คีย์บิลเดิมใหม่หลัง void → ต้องผ่าน (batch2 ยัง pending_approval อยู่)')
  const redo = await sb.rpc('award_points_from_batch', { p_batch_id: batch2, p_admin: admin.id })
  check('RPC ยอมรับบิลเดิมหลัง void', !redo.error, redo.error?.message)
  const afterRedo = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มขึ้นใหม่เป็น 90', afterRedo.data?.points_balance === 90, String(afterRedo.data?.points_balance))

  // ---------- ปฏิเสธชุดที่ยังรอผู้อนุมัติ ----------
  console.log('\n[5b] ปฏิเสธชุด pending_approval (void ก่อนแต้มเข้า) → ไม่มีเงินขยับ')
  const batch3 = await mkBatch('e2e-3.xlsx')
  const rejectEarly = await sb.rpc('void_batch', { p_batch_id: batch3, p_admin: admin.id, p_reason: 'e2e reject previewed' })
  check('void ชุด previewed → ถูกปฏิเสธ (อัปโหลดทับได้อยู่แล้ว)', !!rejectEarly.error && rejectEarly.error.message.includes('can be voided'), rejectEarly.error?.message ?? 'ไม่ error')
  await submitBatch(batch3)
  const reject = await sb.rpc('void_batch', { p_batch_id: batch3, p_admin: admin.id, p_reason: 'e2e reject' })
  check('void ชุด pending_approval สำเร็จ', !reject.error, reject.error?.message)
  const bat3 = await sb.from('point_batches').select('status, voided_by, void_reason').eq('id', batch3).single()
  check('batch3 = voided · บันทึกคน/เหตุผล', bat3.data?.status === 'voided' && bat3.data?.voided_by === admin.id && bat3.data?.void_reason === 'e2e reject', JSON.stringify(bat3.data))
  const noLedger = await sb.from('point_batch_ledger').select('id').eq('source_batch_id', batch3)
  const noTx = await sb.from('point_transactions').select('id').eq('source_batch_id', batch3)
  check('ไม่มี ledger / transaction ของชุดที่ถูกปฏิเสธ', (noLedger.data ?? []).length === 0 && (noTx.data ?? []).length === 0)
  const afterReject = await sb.from('user_profiles').select('points_balance').eq('id', user.id).single()
  check('แต้มยังเป็น 90 (ไม่ขยับ)', afterReject.data?.points_balance === 90, String(afterReject.data?.points_balance))

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
