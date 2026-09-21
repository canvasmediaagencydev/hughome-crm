/**
 * ตรวจว่า migration 013–025 ขึ้นครบบน Supabase หรือยัง
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
  // 018 = 29 · 024 เพิ่ม batches.approve = 30
  record(perms.count === 30, '018+024 · admin_permissions = 30', `ได้ ${perms.count ?? perms.error}`)

  const newKeys = await count(
    'admin_permissions',
    '&permission_key=in.(campaigns.view,campaigns.manage,salesreps.view,salesreps.manage)'
  )
  record(newKeys.count === 4, '018 · campaigns.* + salesreps.* ครบ 4', `ได้ ${newKeys.count ?? newKeys.error}`)

  const oldKeys = await count('admin_permissions', '&permission_key=in.(promos.view,promos.manage)')
  record(oldKeys.count === 0, '018 · promos.* ถูกลบแล้ว', `ได้ ${oldKeys.count ?? oldKeys.error}`)

  // --- 019: committed_by ---
  record(await columnExists('point_batches', 'committed_by'), '019 · point_batches.committed_by')

  // --- 021: redemption_lots (RPC cancel_redemption ตรวจใน SQL Editor) ---
  record(await tableExists('redemption_lots'), '021 · ตาราง redemption_lots มีอยู่')

  // --- 022: notification_log + balance_reconcile_log (RPC reconcile_balances ตรวจใน SQL Editor) ---
  record(await tableExists('notification_log'), '022 · ตาราง notification_log มีอยู่')
  record(await tableExists('balance_reconcile_log'), '022 · ตาราง balance_reconcile_log มีอยู่')

  // --- 023: notification_channels columns (RPC redeem_reward v3 / generate_pickup_code ตรวจใน SQL Editor) ---
  record(await columnExists('notification_channels', 'last_sent_at'), '023 · notification_channels.last_sent_at')
  record(await columnExists('notification_channels', 'updated_at'), '023 · notification_channels.updated_at')

  // --- 024: approval flow (enum pending_approval + RPC v4 ตรวจใน SQL Editor) ---
  record(await columnExists('point_batches', 'submitted_by'), '024 · point_batches.submitted_by')
  record(await columnExists('point_batches', 'submitted_at'), '024 · point_batches.submitted_at')
  const approve = await count('admin_permissions', '&permission_key=eq.batches.approve')
  record(approve.count === 1, '024 · permission batches.approve มีอยู่', `ได้ ${approve.count ?? approve.error}`)
  const pendingProbe = await count('point_batches', '&status=eq.pending_approval')
  record(!pendingProbe.error, '024 · enum batch_status รับค่า pending_approval', pendingProbe.error)

  // --- 026: email channel + Rollback เฉพาะ super_admin (CHECK constraint ตรวจใน SQL Editor) ---
  const mgrVoid = await fetch(
    `${url}/rest/v1/admin_role_permissions?select=role_id,admin_roles!inner(name),admin_permissions!inner(permission_key)&admin_roles.name=eq.manager&admin_permissions.permission_key=eq.batches.void`,
    { headers: { ...headers, Prefer: 'count=exact', Range: '0-0' } }
  )
  const mgrVoidCount = Number((mgrVoid.headers.get('content-range') ?? '/x').split('/')[1])
  record(mgrVoidCount === 0, '026 · manager ไม่มี batches.void แล้ว (Rollback = super_admin)', `ได้ ${Number.isNaN(mgrVoidCount) ? mgrVoid.status : mgrVoidCount}`)

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
      "   • function cancel_redemption(uuid, uuid, text) มีอยู่ (021)\n" +
      "   • function reconcile_balances() มีอยู่ (022)\n" +
      "   • function generate_pickup_code() + index redemptions_pickup_code_key (023)\n" +
      "   • award_points_from_batch ต้องปฏิเสธ status previewed (024) และ expires_at = วันอนุมัติ + 365 (025) — e2e-batch-flow.js พิสูจน์\n" +
      '   ดู block VERIFICATION ท้ายไฟล์ supabase/_apply_013_020.sql'
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
