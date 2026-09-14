/**
 * สร้างไฟล์รวม SQL จาก supabase/migrations/0*.sql
 *
 *   node scripts/build-apply-all.js --tenant pilot            → _apply_all.sql (001–ล่าสุด)
 *   node scripts/build-apply-all.js --from 013 --to 020       → _apply_013_020.sql (ช่วงเดียว)
 *
 * โหมด --from/--to ใช้ตอน DB มี migration เก่า apply ไปแล้ว — วางไฟล์รวมทั้งชุดจะพัง
 * ที่ CREATE TYPE/CREATE TABLE ของไฟล์เก่า · โหมดช่วงไม่ใส่ INSERT tenant_code (ตั้งไปแล้ว)
 *
 * ไฟล์ _apply_all.sql เดิมเขียนหัวไว้ว่า "สร้างอัตโนมัติ" แต่ไม่มี generator จริง
 * → เพิ่ม migration แล้วลืมอัปเดตไฟล์รวมได้ง่าย สคริปต์นี้ปิดช่องนั้น
 *
 * --tenant ไม่มี default โดยเจตนา: ไฟล์รวมมี INSERT tenant_code ต่อ instance อยู่ข้างใน
 * ถ้าเดาให้ จะมีวันที่ใครรัน _apply_all ของ pilot ทับ instance อื่น
 */
const fs = require('fs')
const path = require('path')

const MIG_DIR = path.join(__dirname, '..', 'supabase', 'migrations')
const SUPA_DIR = path.join(__dirname, '..', 'supabase')
const BAR = '═'.repeat(75)

function arg(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? null : process.argv[i + 1] || null
}

const from = arg('from')
const to = arg('to')
const rangeMode = Boolean(from || to)
const tenant = arg('tenant')

if (rangeMode) {
  if (!from || !to) {
    console.error('\nโหมดช่วงต้องระบุทั้งคู่:  node scripts/build-apply-all.js --from 013 --to 020\n')
    process.exit(1)
  }
  if (!/^\d{3}$/.test(from) || !/^\d{3}$/.test(to) || from > to) {
    console.error(`\n--from/--to ต้องเป็นเลข 3 หลักและ from <= to (ได้ ${from}/${to})\n`)
    process.exit(1)
  }
} else if (!tenant) {
  console.error('\nต้องระบุ tenant_code:  node scripts/build-apply-all.js --tenant pilot\n')
  process.exit(1)
}

let files = fs
  .readdirSync(MIG_DIR)
  .filter((f) => /^\d{3}_.*\.sql$/.test(f))
  .sort()

if (rangeMode) {
  files = files.filter((f) => f.slice(0, 3) >= from && f.slice(0, 3) <= to)
}

if (files.length === 0) {
  console.error(
    rangeMode ? `ไม่พบไฟล์ migration ในช่วง ${from}–${to}` : 'ไม่พบไฟล์ migration ใน ' + MIG_DIR
  )
  process.exit(1)
}

const OUT_FILE = path.join(SUPA_DIR, rangeMode ? `_apply_${from}_${to}.sql` : '_apply_all.sql')

const first = files[0].slice(0, 3)
const last = files[files.length - 1].slice(0, 3)

const parts = rangeMode
  ? [
      `-- ${BAR}`,
      `-- _apply_${from}_${to}.sql — HugHome CRM · migration ${first}–${last} เท่านั้น (incremental)`,
      `-- สร้างอัตโนมัติด้วย: node scripts/build-apply-all.js --from ${from} --to ${to}`,
      `-- (อย่าแก้ไฟล์นี้มือ — แก้ที่ migration ต้นทางแล้วรัน generator ใหม่)`,
      `--`,
      `-- ⚠️ ใช้กับ DB ที่ apply migration ก่อน ${first} ไปแล้วเท่านั้น`,
      `--    ถ้าเป็น DB ใหม่เปล่า ๆ ให้ใช้ _apply_all.sql แทน`,
      `-- ไม่มี INSERT tenant_code ในไฟล์นี้ (ตั้งไปแล้วตอน apply ชุดแรก)`,
      `-- วิธี apply: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run`,
      `-- ${BAR}`,
      '',
    ]
  : [
      `-- ${BAR}`,
      `-- _apply_all.sql — HugHome CRM Pilot · รวม migration ${first}–${last} + seed tenant_code`,
      `-- สร้างอัตโนมัติด้วย: node scripts/build-apply-all.js --tenant ${tenant}`,
      `-- (อย่าแก้ไฟล์นี้มือ — แก้ที่ migration ต้นทางแล้วรัน generator ใหม่)`,
      `--`,
      `-- ⚠️ ไฟล์นี้สำหรับ DB ใหม่เปล่า ๆ เท่านั้น — DB ที่ apply ไปบางส่วนแล้วจะพังที่ CREATE ซ้ำ`,
      `--    ให้ใช้โหมดช่วงแทน: node scripts/build-apply-all.js --from NNN --to NNN`,
      `-- วิธี apply: Supabase Dashboard → SQL Editor → New query → วางทั้งไฟล์ → Run`,
      `-- ${BAR}`,
      '',
    ]

for (const f of files) {
  parts.push(
    '',
    `-- ${BAR}`,
    `-- ▶ FILE: ${f}`,
    `-- ${BAR}`,
    fs.readFileSync(path.join(MIG_DIR, f), 'utf8').trimEnd(),
    ''
  )
}

if (!rangeMode) {
  parts.push(
    '',
    `-- ${BAR}`,
    `-- ▶ instance config: tenant_code (ต่อ instance — ${tenant})`,
    `-- ${BAR}`,
    `INSERT INTO app_config(key,value) VALUES ('tenant_code','${tenant}')`,
    `  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`,
    ''
  )
}

parts.push(
  '',
  `-- ${BAR}`,
  '-- ▶ VERIFICATION — รันหลัง apply เพื่อเช็คว่าขึ้นครบ',
  `-- ${BAR}`,
  "-- SELECT count(*) FROM pg_tables WHERE schemaname='public';                    -- คาดหวัง 20",
  "-- SELECT count(*) FROM pg_tables WHERE schemaname='public'",
  "--   AND tablename IN ('receipts','receipt_images','promo_codes');         -- คาดหวัง 0",
  "-- SELECT count(*) FROM pg_tables WHERE schemaname='public'",
  "--   AND tablename IN ('sales_reps','point_campaigns','redemption_lots','notification_log','balance_reconcile_log');  -- คาดหวัง 5",
  '-- SELECT count(*) FROM admin_permissions;                                 -- คาดหวัง 29',
  '-- SELECT count(*) FROM admin_roles;                                       -- คาดหวัง 6',
  '-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace',
  "--   WHERE n.nspname='public' AND p.proname IN ('award_points_from_batch','void_batch','redeem_reward','expire_ledger_batches','adjust_points_manual','cancel_redemption','reconcile_balances');  -- คาดหวัง 7",
  "-- SELECT conname FROM pg_constraint WHERE conname='point_campaigns_no_overlap';  -- คาดหวัง 1 แถว",
  "-- SELECT indexname FROM pg_indexes WHERE indexname='pbl_bill_no_active_idx';     -- คาดหวัง 1 แถว",
  "-- SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace",
  "--   WHERE n.nspname='public' AND p.proname='award_points_from_batch';       -- คาดหวัง 'uuid, uuid' (1 แถว)",
  "-- SELECT count(*) FROM information_schema.columns WHERE table_name='point_batches' AND column_name='committed_by';  -- คาดหวัง 1",
  ...(rangeMode
    ? []
    : [`-- SELECT value FROM app_config WHERE key='tenant_code';                    -- คาดหวัง '${tenant}'`]),
  ''
)

fs.writeFileSync(OUT_FILE, parts.join('\n'))
console.log(`written: ${OUT_FILE}`)
console.log(
  `migrations: ${first}–${last} (${files.length} ไฟล์)` +
    (rangeMode ? ' · incremental (ไม่มี tenant_code)' : ` · tenant_code=${tenant}`)
)
