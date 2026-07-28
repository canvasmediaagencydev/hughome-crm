/**
 * ตรวจว่า migration 013–020 ขึ้นครบบน Supabase หรือยัง
 *
 *   node scripts/verify-schema.js
 *
 * ใช้ service_role key ผ่าน PostgREST → ไม่ต้องมี DB password / access token
 *
 * ⚠️ ตรวจได้แค่ "ตาราง/คอลัมน์/ข้อมูล" · constraint, index, signature ของ function
 *    PostgREST มองไม่เห็น → ต้องรัน block VERIFICATION ท้าย supabase/_apply_013_020.sql
 *    ใน SQL Editor เพิ่ม (สคริปต์นี้จะเตือนไว้ตอนจบ)
 */
require('dotenv').config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('ขาด NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน .env.local')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }
const results = []

function record(ok, label, detail) {
  results.push({ ok, label, detail })
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`)
}

async function req(path, extraHeaders = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { headers: { ...headers, ...extraHeaders } })
  return { status: res.status, body: await res.text() }
}

async function tableExists(name) {
  const { status } = await req(`${name}?select=*&limit=0`)
  return status === 200
}

async function columnExists(table, column) {
  const { status } = await req(`${table}?select=${column}&limit=0`)
  return status === 200
}

async function count(table, query = '') {
  const { status, body } = await req(`${table}?select=*${query}`, {
    Prefer: 'count=exact',
    Range: '0-0',
  })
  if (status >= 400) return { error: body.slice(0, 120) }
  // PostgREST คืนจำนวนจริงใน header content-range แต่ fetch ข้างบนอ่าน body ไปแล้ว
  // → ยิงซ้ำเพื่ออ่าน header (ยอมจ่ายอีก 1 request เพื่อความชัด)
  const res = await fetch(`${url}/rest/v1/${table}?select=*${query}`, {
    headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
  })
  const cr = res.headers.get('content-range') || ''
  return { count: Number(cr.split('/')[1]) }
}

async function main() {
  console.log(`ตรวจ ${url}\n`)

  // --- 013 / 014: ตารางใหม่ ---
  record(await tableExists('sales_reps'), '013 · ตาราง sales_reps มีอยู่')
  record(await tableExists('point_campaigns'), '014 · ตาราง point_campaigns มีอยู่')

  // --- 015: ledger traceability + promo_codes หายไป ---
  const promoGone = !(await tableExists('promo_codes'))
  record(promoGone, '015 · promo_codes ถูก DROP แล้ว')

  for (const col of ['purchase_date', 'bill_no', 'sales_rep_id', 'campaign_id', 'voided']) {
    record(await columnExists('point_batch_ledger', col), `015 · point_batch_ledger.${col}`)
  }
  const promoColGone = !(await columnExists('point_batch_ledger', 'promo_code_id'))
  record(promoColGone, '015 · point_batch_ledger.promo_code_id ถูกลบแล้ว')

  // --- 018: permissions ---
  const perms = await count('admin_permissions')
  record(perms.count === 29, '018 · admin_permissions = 29', `ได้ ${perms.count ?? perms.error}`)

  const newKeys = await count(
    'admin_permissions',
    '&permission_key=in.(campaigns.view,campaigns.manage,salesreps.view,salesreps.manage)'
  )
  record(newKeys.count === 4, '018 · campaigns.* + salesreps.* ครบ 4', `ได้ ${newKeys.count ?? newKeys.error}`)

  const oldKeys = await count('admin_permissions', '&permission_key=in.(promos.view,promos.manage)')
  record(oldKeys.count === 0, '018 · promos.* ถูกลบแล้ว', `ได้ ${oldKeys.count ?? oldKeys.error}`)

  // --- 019: committed_by ---
  record(await columnExists('point_batches', 'committed_by'), '019 · point_batches.committed_by')

  // --- สรุป ---
  const failed = results.filter((r) => !r.ok)
  console.log(
    `\n${results.length - failed.length}/${results.length} ผ่าน` +
      (failed.length ? ` · ตก ${failed.length} ข้อ` : '')
  )
  console.log(
    '\n⚠️ ยังตรวจไม่ได้จากที่นี่ (PostgREST มองไม่เห็น) — ต้องรันใน SQL Editor:\n' +
      "   • constraint point_campaigns_no_overlap (EXCLUDE)\n" +
      "   • index pbl_bill_no_active_idx (unique bill_no)\n" +
      "   • signature award_points_from_batch ต้องเป็น (uuid, uuid) เท่านั้น\n" +
      '   ดู block VERIFICATION ท้ายไฟล์ supabase/_apply_013_020.sql'
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
