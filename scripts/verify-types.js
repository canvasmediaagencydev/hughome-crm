/**
 * เทียบ database.types.ts กับ schema จริงบน Supabase
 *
 *   node scripts/verify-types.js
 *
 * ใช้ OpenAPI spec ที่ PostgREST สร้างจาก catalog ของ DB จริง (ผ่าน service_role)
 * → จับได้ทั้งตารางขาด/เกิน คอลัมน์ขาด/เกิน และ nullability ผิด
 *
 * ทำไมต้องมี: ถ้า `supabase gen types` รันไม่ได้ (ไม่มี access token / non-TTY)
 * แล้วมีคนแก้ database.types.ts ด้วยมือ ไฟล์นี้คือตัวพิสูจน์ว่าแก้ถูก
 * ⚠️ ไม่ได้แทน `supabase gen types` — ตรวจ Enums / Functions / CompositeTypes ไม่ได้
 */
require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('ขาด NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  process.exit(1)
}

const TYPES_FILE = path.join(__dirname, '..', 'database.types.ts')

/** ดึง { table: { col: isNullable } } จาก Row block ของ database.types.ts */
function parseTypes(src) {
  const out = {}
  // จับเฉพาะ Tables block (ตัด Views/Functions/Enums ทิ้ง)
  const tablesStart = src.indexOf('    Tables: {')
  const viewsStart = src.indexOf('\n    Views: {', tablesStart)
  const fnStart = src.indexOf('\n    Functions: {', tablesStart)
  const end = [viewsStart, fnStart].filter((i) => i > -1).sort((a, b) => a - b)[0] ?? src.length
  const body = src.slice(tablesStart, end)

  const tableRe = /^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm
  let m
  while ((m = tableRe.exec(body))) {
    const cols = {}
    for (const line of m[2].split('\n')) {
      const c = line.match(/^ {10}(\w+)(\?)?: (.+)$/)
      if (c) cols[c[1]] = / \| null$/.test(c[3])
    }
    out[m[1]] = cols
  }
  return out
}

async function main() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' },
  })
  if (!res.ok) {
    console.error('ดึง OpenAPI ไม่ได้:', res.status, (await res.text()).slice(0, 200))
    process.exit(1)
  }
  const defs = (await res.json()).definitions || {}
  const live = {}
  for (const [t, d] of Object.entries(defs)) {
    const required = new Set(d.required || [])
    live[t] = Object.fromEntries(Object.keys(d.properties || {}).map((c) => [c, !required.has(c)]))
  }

  const declared = parseTypes(fs.readFileSync(TYPES_FILE, 'utf8'))
  const problems = []

  const liveTables = Object.keys(live).sort()
  const declTables = Object.keys(declared).sort()

  for (const t of liveTables) if (!declared[t]) problems.push(`ตาราง "${t}" มีใน DB แต่ไม่มีใน types`)
  for (const t of declTables) if (!live[t]) problems.push(`ตาราง "${t}" มีใน types แต่ไม่มีใน DB`)

  for (const t of liveTables) {
    if (!declared[t]) continue
    for (const [c, nullable] of Object.entries(live[t])) {
      if (!(c in declared[t])) {
        problems.push(`${t}.${c} — มีใน DB แต่ไม่มีใน types`)
      } else if (declared[t][c] !== nullable) {
        problems.push(
          `${t}.${c} — nullability ไม่ตรง (DB: ${nullable ? 'nullable' : 'NOT NULL'} · types: ${declared[t][c] ? 'nullable' : 'NOT NULL'})`
        )
      }
    }
    for (const c of Object.keys(declared[t])) {
      if (!(c in live[t])) problems.push(`${t}.${c} — มีใน types แต่ไม่มีใน DB`)
    }
  }

  const totalCols = liveTables.reduce((n, t) => n + Object.keys(live[t]).length, 0)
  console.log(`ตาราง: ${liveTables.length} (DB) / ${declTables.length} (types) · คอลัมน์ที่ตรวจ: ${totalCols}\n`)

  if (problems.length === 0) {
    console.log('✅ database.types.ts ตรงกับ schema จริงทุกตาราง ทุกคอลัมน์ ทุก nullability')
  } else {
    console.log(`❌ ไม่ตรง ${problems.length} จุด:`)
    for (const p of problems) console.log('   ·', p)
  }
  console.log(
    '\nℹ️ ไฟล์นี้ตรวจแค่ Tables — Enums / Functions / CompositeTypes ยังต้องพึ่ง `supabase gen types`'
  )
  process.exit(problems.length ? 1 : 0)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
