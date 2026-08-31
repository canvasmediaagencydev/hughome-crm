/**
 * ตรวจว่าฐาน pilot พร้อม demo จริงหรือยัง
 *
 *   node scripts/verify-demo-ready.js
 *
 * ต่างจาก verify-demo-batch.js ตรงที่ตัวนั้นใช้ context "จำลอง"
 * ตัวนี้ดึงพนักงาน/แคมเปญ/ลูกค้า/อัตราแลกแต้ม **จาก DB จริง** มาป้อน parser
 * → จับได้ถ้า seed กับไฟล์ demo ไม่ตรงกัน (รหัสพนักงานเพี้ยน เบอร์ไม่ตรง แคมเปญคนละช่วง)
 *
 * อ่านอย่างเดียว ไม่เขียนอะไรลง DB
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const { createClient } = require('@supabase/supabase-js')

const ROOT = path.join(__dirname, '..')
const DEMO_DIR = path.join(ROOT, 'docs', 'demo')
const SPEC = require('../src/lib/excel/sales-columns.json')

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

function loadParser() {
  fs.mkdirSync(path.join(ROOT, 'node_modules', '.cache'), { recursive: true })
  const out = fs.mkdtempSync(path.join(ROOT, 'node_modules', '.cache', 'readyparse-'))
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

async function main() {
  const EXPECT = JSON.parse(fs.readFileSync(path.join(DEMO_DIR, 'expected.json'), 'utf8'))
  const xlsxName = fs.readdirSync(DEMO_DIR).find((f) => f.endsWith('.xlsx'))
  if (!xlsxName) throw new Error('ไม่พบไฟล์ .xlsx ใน docs/demo/')

  console.log('ฐาน:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // ---------------- 1. ข้อมูล seed ----------------
  console.log('\n[1] ข้อมูลที่ seed ลงฐาน')
  const reps = (await sb.from('sales_reps').select('*').order('code')).data ?? []
  check('พนักงานขาย 4 คน', reps.length === 4, `ได้ ${reps.length}`)
  check(
    'รหัส S01–S04 ครบและ active',
    ['S01', 'S02', 'S03', 'S04'].every((c) => reps.some((r) => r.code === c && r.is_active)),
    reps.map((r) => `${r.code}${r.is_active ? '' : '(ปิด)'}`).join(',')
  )

  const camps = (await sb.from('point_campaigns').select('*').order('starts_on')).data ?? []
  check('แคมเปญ 3 ช่วง', camps.length === 3, `ได้ ${camps.length}`)
  camps.forEach((c) => console.log(`     · ${c.name} · x${c.multiplier} · ${c.starts_on} → ${c.ends_on}`))

  let overlap = false
  for (let i = 0; i < camps.length; i++)
    for (let j = i + 1; j < camps.length; j++)
      if (camps[i].starts_on <= camps[j].ends_on && camps[j].starts_on <= camps[i].ends_on) overlap = true
  check('ช่วงแคมเปญไม่ซ้อนกัน', !overlap)

  const today = new Date().toISOString().slice(0, 10)
  const activeNow = camps.find((c) => c.is_active && today >= c.starts_on && today <= c.ends_on)
  check(`วันนี้ (${today}) มีแคมเปญ active`, !!activeNow, activeNow ? `x${activeNow.multiplier}` : 'ไม่มี')

  const demoUsers = (await sb.from('user_profiles').select('*').like('line_user_id', 'Udemo-%').order('phone')).data ?? []
  check('ลูกค้าสาธิต 8 คน', demoUsers.length === 8, `ได้ ${demoUsers.length}`)
  check('ทุกคนเริ่มที่ 0 แต้ม', demoUsers.every((u) => u.points_balance === 0),
    demoUsers.map((u) => `${u.phone}:${u.points_balance}`).join(' '))
  check('ไม่มี line_user_id ที่ดูเหมือนของจริง',
    demoUsers.every((u) => u.line_user_id.startsWith('Udemo-')))

  // ---------------- 2. อัตราแลกแต้ม ----------------
  const setting = (await sb.from('point_settings').select('setting_value').eq('setting_key', 'baht_per_point').maybeSingle()).data
  const bahtPerPoint = Number(setting?.setting_value)
  check('baht_per_point = 100', bahtPerPoint === 100, String(bahtPerPoint))

  // ---------------- 3. เลขบิลยังไม่ถูกใช้ ----------------
  console.log('\n[2] เลขบิลในไฟล์ demo ยังว่างอยู่ไหม')
  const bills = EXPECT.expected.map((e) => e.bill)
  const used = (await sb.from('point_batch_ledger').select('bill_no').eq('voided', false).in('bill_no', bills)).data ?? []
  check('ยังไม่มีเลขบิล DM-2607-* ถูกใช้', used.length === 0,
    used.length ? 'ถูกใช้แล้ว: ' + used.map((u) => u.bill_no).join(',') : '')

  const sha = (await sb.from('point_batches').select('id, file_name, status').like('file_name', 'demo-%')).data ?? []
  check('ยังไม่เคยอัปโหลดไฟล์ demo', sha.length === 0,
    sha.length ? sha.map((b) => `${b.file_name}(${b.status})`).join(',') : '')

  // ---------------- 4. parse ด้วยข้อมูลจาก DB จริง ----------------
  console.log('\n[3] รัน parser กับไฟล์ demo โดยใช้ข้อมูลจาก DB จริง')
  const dir = loadParser()
  const { parseSalesBatch } = await import(path.join(dir, 'parser.mjs'))

  const usersByPhone = new Map(demoUsers.filter((u) => u.phone).map((u) => [u.phone, u.id]))
  const result = await parseSalesBatch(fs.readFileSync(path.join(DEMO_DIR, xlsxName)), {
    weekStart: EXPECT.week.start,
    weekEnd: EXPECT.week.end,
    bahtPerPoint,
    salesReps: reps,
    activeCampaigns: camps.filter((c) => c.is_active).map((c) => ({ ...c, multiplier: Number(c.multiplier) })),
    usersByPhone,
    billsInUse: new Map(),
  })

  const s = result.summary
  console.log(`     ทั้งหมด ${s.total} · ใช้ได้ ${s.valid} · ผิดพลาด ${s.invalid} · ไม่พบลูกค้า ${s.unmatched} · รวม ${s.total_points} แต้ม`)
  check('ใช้ได้ 8 แถว', s.valid === 8, String(s.valid))
  check('ไม่พบลูกค้า 1 แถว', s.unmatched === 1, String(s.unmatched))
  check('ผิดพลาด 1 แถว', s.invalid === 1, String(s.invalid))
  check('รวม 687 แต้ม', s.total_points === 687, String(s.total_points))
  check('ทุกแถว valid จับคู่ user_id ได้จริงจาก DB',
    result.rows.filter((r) => r.status === 'valid').every((r) => !!r.user_id))
  check('ทุกแถว valid จับคู่ sales_rep_id ได้จริงจาก DB',
    result.rows.filter((r) => r.status === 'valid').every((r) => !!r.sales_rep_id))

  console.log('\n[4] แต้มที่แต่ละคนจะได้ (ไว้เทียบหน้า "จัดการผู้ใช้" หลัง commit)')
  const nameById = new Map(demoUsers.map((u) => [u.id, u.display_name ?? u.phone]))
  const perUser = new Map()
  for (const r of result.rows.filter((x) => x.status === 'valid')) {
    perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + r.points)
  }
  for (const [uid, pts] of perUser) console.log(`     ${String(nameById.get(uid)).padEnd(22)} ${String(pts).padStart(4)} แต้ม`)
  check('ลูกค้าได้แต้ม 8 คน', perUser.size === 8, String(perUser.size))
  check('ผลรวมตรงกับ summary', [...perUser.values()].reduce((a, b) => a + b, 0) === s.total_points)

  fs.rmSync(dir, { recursive: true, force: true })

  console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
  if (failures.length) {
    console.log('\nที่ตก:')
    failures.forEach((f) => console.log('  · ' + f))
    process.exit(1)
  }
  console.log('\n🎬 พร้อม demo — อัปโหลด docs/demo/' + xlsxName)
  console.log(`   เลือกสัปดาห์ ${EXPECT.week.start} → ${EXPECT.week.end} แล้วกดยืนยัน จะได้ ${s.total_points} แต้ม`)
}

main().catch((e) => {
  console.error('\nERROR:', e.message)
  process.exit(1)
})
