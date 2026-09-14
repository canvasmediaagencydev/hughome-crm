/**
 * E2E Sprint 8 ผ่าน HTTP จริง — 4 สถานะ / QR lookup / cancel / notification channels
 *
 *   node scripts/e2e-sprint8-http.js --yes [base-url]     (default: https://pilot-phase1.vercel.app)
 *
 * ⚠️ เขียน DB จริง: สร้างลูกค้า + รางวัลทดสอบ (tag E2E-S8-*), redeem ผ่าน RPC, ยิง admin API
 *    บน base-url ด้วย token ของ admin คนแรกที่ is_active (ออกผ่าน magic link — ไม่ต้องรู้รหัสผ่าน
 *    และไม่เปลี่ยนรหัสผ่าน แต่ last_sign_in_at ของ admin คนนั้นจะขยับ) แล้วลบทุกอย่างที่สร้าง
 *
 * ที่ทดสอบไม่ได้จากที่นี่: POST /api/rewards/redeem (ต้องมี LIFF session cookie) → การยิง
 * notifyTeam หลังแลกจึงไม่ถูก exercise · ทดสอบเฉพาะ POST /notifications/:id/test แทน
 */
require('dotenv').config({ path: '.env.local', quiet: true })
const { createClient } = require('@supabase/supabase-js')

if (!process.argv.includes('--yes')) {
  console.error('สคริปต์นี้เขียน DB จริงและยิง API บน prod — ใส่ --yes เพื่อยืนยัน')
  process.exit(2)
}
const BASE = (process.argv.find((a) => a.startsWith('http')) ?? 'https://pilot-phase1.vercel.app').replace(/\/$/, '')

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const sb = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const TAG = 'E2E-S8-' + Date.now()
const created = { userId: null, rewardId: null, channelIds: [] }
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

let token = null
async function api(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (!opts.anon) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { status: res.status, json }
}

async function invariant(label, expected) {
  const [{ data: p }, { data: lots }] = await Promise.all([
    sb.from('user_profiles').select('points_balance').eq('id', created.userId).single(),
    sb.from('point_batch_ledger').select('points_remaining').eq('user_id', created.userId),
  ])
  const sum = (lots ?? []).reduce((a, l) => a + l.points_remaining, 0)
  check(`${label}: balance ${p.points_balance} == ledger ${sum}`, p.points_balance === sum)
  if (expected !== undefined) check(`${label}: balance = ${expected}`, p.points_balance === expected, String(p.points_balance))
}

async function cleanup() {
  for (const id of created.channelIds) await sb.from('notification_channels').delete().eq('id', id)
  if (created.userId) {
    const { data: reds } = await sb.from('redemptions').select('id').eq('user_id', created.userId)
    for (const r of reds ?? []) await sb.from('redemption_lots').delete().eq('redemption_id', r.id)
    await sb.from('redemptions').delete().eq('user_id', created.userId)
    await sb.from('point_transactions').delete().eq('user_id', created.userId)
    await sb.from('point_batch_ledger').delete().eq('user_id', created.userId)
    await sb.from('user_profiles').delete().eq('id', created.userId)
  }
  if (created.rewardId) await sb.from('rewards').delete().eq('id', created.rewardId)
  // ของค้างจากรอบก่อนที่ crash
  const { data: stale } = await sb.from('user_profiles').select('id').like('line_user_id', 'E2E-S8-%')
  for (const u of stale ?? []) {
    const { data: reds } = await sb.from('redemptions').select('id').eq('user_id', u.id)
    for (const r of reds ?? []) await sb.from('redemption_lots').delete().eq('redemption_id', r.id)
    await sb.from('redemptions').delete().eq('user_id', u.id)
    await sb.from('point_transactions').delete().eq('user_id', u.id)
    await sb.from('point_batch_ledger').delete().eq('user_id', u.id)
    await sb.from('user_profiles').delete().eq('id', u.id)
  }
  await sb.from('rewards').delete().like('name', 'E2E-S8-%')
  await sb.from('notification_channels').delete().like('target_id', 'C' + 'e2e5'.repeat(8))
}

async function adminToken() {
  const { data: admin } = await sb.from('admin_users').select('id, email, auth_user_id').eq('is_active', true).limit(1).single()
  if (!admin) throw new Error('ไม่มี admin_users ที่ is_active')
  const { data: link, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email: admin.email })
  if (error) throw new Error('generateLink: ' + error.message)
  const anon = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: sess, error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (vErr) throw new Error('verifyOtp: ' + vErr.message)
  return { admin, token: sess.session.access_token }
}

async function main() {
  console.log(`ยิงไปที่ ${BASE}\n`)
  const a = await adminToken()
  token = a.token
  const admin = a.admin

  console.log('[0] fixtures')
  const { data: user, error: uErr } = await sb
    .from('user_profiles')
    .insert({ line_user_id: TAG, phone: '09' + String(Date.now()).slice(-8), birthday: '1990-01-01', first_name: 'ลูกค้า', last_name: 'ทดสอบ S8', role: 'homeowner' })
    .select()
    .single()
  if (uErr) throw new Error('สร้าง user ไม่ได้: ' + uErr.message)
  created.userId = user.id
  const { data: reward, error: rErr } = await sb.from('rewards').insert({ name: TAG + ' reward', points_cost: 100, stock_quantity: 5 }).select().single()
  if (rErr) throw new Error('สร้าง reward ไม่ได้: ' + rErr.message)
  created.rewardId = reward.id
  const adj = await sb.rpc('adjust_points_manual', { p_user: user.id, p_delta: 500, p_admin: admin.id, p_note: 'e2e s8 +500' })
  check('adjust +500', adj.data === 500, adj.error?.message)

  const redeem = async () => {
    const r = await sb.rpc('redeem_reward', { p_user: user.id, p_reward: reward.id, p_qty: 1 })
    if (r.error) throw new Error('redeem: ' + r.error.message)
    const { data } = await sb.from('redemptions').select('id, status, pickup_code').eq('id', r.data).single()
    return data
  }

  console.log('\n[1] auth: ทุก route ใหม่ตอบ 401 ถ้าไม่มี token')
  for (const [m, p] of [
    ['GET', '/api/admin/notifications'],
    ['POST', '/api/admin/notifications'],
    ['GET', '/api/admin/redemptions/lookup?code=ABCD2345'],
    ['PATCH', '/api/admin/redemptions/00000000-0000-0000-0000-000000000000/status'],
    ['POST', '/api/admin/redemptions/00000000-0000-0000-0000-000000000000/cancel'],
  ]) {
    const r = await api(m, p, m === 'GET' ? undefined : { status: 'approved' }, { anon: true })
    check(`${m} ${p} → 401`, r.status === 401, String(r.status))
  }

  console.log('\n[2] redeem → pickup_code + lookup')
  const r1 = await redeem()
  check('pickup_code รูปแบบ 8 ตัว ไม่มี 0/O/1/I', /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(r1.pickup_code ?? ''), String(r1.pickup_code))
  await invariant('หลัง redeem #1', 400)
  let lk = await api('GET', `/api/admin/redemptions/lookup?code=${r1.pickup_code.toLowerCase()}`)
  check('lookup (พิมพ์เล็ก) → 200 + status requested + ลูกค้าถูกคน', lk.status === 200 && lk.json?.redemption?.status === 'requested' && lk.json.redemption.user_profiles?.id === user.id, `${lk.status} ${JSON.stringify(lk.json).slice(0, 120)}`)
  lk = await api('GET', '/api/admin/redemptions/lookup?code=ABCD0000')
  check('lookup รหัสมี 0 → 400', lk.status === 400, String(lk.status))
  lk = await api('GET', '/api/admin/redemptions/lookup?code=ZZZZZZZZ')
  check('lookup รหัสไม่มีจริง → 404', lk.status === 404, String(lk.status))

  console.log('\n[3] 4 สถานะ: เดินหน้าทีละขั้น ห้ามข้าม')
  let s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'ready' })
  check('requested → ready (ข้ามขั้น) → 409', s.status === 409, `${s.status} ${s.json?.error}`)
  s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'delivered' })
  check('requested → delivered (ข้ามขั้น) → 409', s.status === 409, String(s.status))
  s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'cancelled' })
  check('status: cancelled ผ่านทางนี้ → 400', s.status === 400, String(s.status))
  s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'approved', adminNotes: 'e2e approve' })
  check('requested → approved → 200 + processed_by = admin', s.status === 200 && s.json?.redemption?.status === 'approved' && s.json.redemption.processed_by === admin.id, `${s.status} ${s.json?.error ?? ''}`)
  s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'approved' })
  check('approved อีกรอบ → 409', s.status === 409, String(s.status))
  s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'ready' })
  check('approved → ready → 200', s.status === 200 && s.json?.redemption?.status === 'ready', `${s.status} ${s.json?.error ?? ''}`)
  lk = await api('GET', `/api/admin/redemptions/lookup?code=${r1.pickup_code}`)
  check('lookup เห็น ready', lk.json?.redemption?.status === 'ready')
  s = await api('PATCH', `/api/admin/redemptions/${r1.id}/status`, { status: 'delivered' })
  check('ready → delivered → 200 + delivered_by/at', s.status === 200 && s.json?.redemption?.status === 'delivered' && s.json.redemption.delivered_by === admin.id && !!s.json.redemption.delivered_at, `${s.status} ${s.json?.error ?? ''}`)
  s = await api('POST', `/api/admin/redemptions/${r1.id}/cancel`, { adminNotes: 'should fail' })
  check('cancel ใบ delivered → 400', s.status === 400 && /only requested\/approved\/ready/.test(s.json?.error ?? ''), `${s.status} ${s.json?.error}`)
  await invariant('หลัง delivered (แต้มไม่คืน)', 400)
  const { data: rw1 } = await sb.from('rewards').select('stock_quantity').eq('id', reward.id).single()
  check('สต็อก 4 (หัก 1 ไม่คืน)', rw1.stock_quantity === 4, String(rw1.stock_quantity))

  console.log('\n[4] cancel ที่ approved → คืนแต้มเข้า lot เดิม + คืนสต็อก')
  const r2 = await redeem()
  await invariant('หลัง redeem #2', 300)
  s = await api('PATCH', `/api/admin/redemptions/${r2.id}/status`, { status: 'approved' })
  check('approved', s.status === 200)
  s = await api('POST', `/api/admin/redemptions/${r2.id}/cancel`, { adminNotes: 'e2e cancel approved' })
  check('cancel approved → 200 + newBalance 400', s.status === 200 && s.json?.newBalance === 400 && s.json.redemption?.status === 'cancelled', `${s.status} ${JSON.stringify(s.json).slice(0, 120)}`)
  await invariant('หลัง cancel #2', 400)
  const { data: rw2 } = await sb.from('rewards').select('stock_quantity').eq('id', reward.id).single()
  check('สต็อกคืนเป็น 4', rw2.stock_quantity === 4, String(rw2.stock_quantity))
  const { data: tx } = await sb.from('point_transactions').select('type, points, created_by').eq('user_id', user.id).eq('type', 'refund')
  check('point_transactions refund +100 โดย admin', tx?.length === 1 && tx[0].points === 100 && tx[0].created_by === admin.id, JSON.stringify(tx))
  s = await api('POST', `/api/admin/redemptions/${r2.id}/cancel`, {})
  check('cancel ซ้ำ → 400', s.status === 400, String(s.status))
  s = await api('PATCH', `/api/admin/redemptions/${r2.id}/status`, { status: 'approved' })
  check('cancelled → approved → 409', s.status === 409, String(s.status))

  console.log('\n[5] cancel ที่ ready + list กรองสถานะ')
  const r3 = await redeem()
  await api('PATCH', `/api/admin/redemptions/${r3.id}/status`, { status: 'approved' })
  await api('PATCH', `/api/admin/redemptions/${r3.id}/status`, { status: 'ready' })
  const list = await api('GET', `/api/admin/redemptions?status=ready&search=${encodeURIComponent(user.phone)}`)
  check('GET list?status=ready เห็นใบนี้ + pickup_code', list.status === 200 && list.json?.redemptions?.some((r) => r.id === r3.id && r.pickup_code === r3.pickup_code), `${list.status} n=${list.json?.redemptions?.length}`)
  s = await api('POST', `/api/admin/redemptions/${r3.id}/cancel`, { adminNotes: 'e2e cancel ready' })
  check('cancel ready → 200', s.status === 200 && s.json?.newBalance === 400, `${s.status} ${s.json?.error ?? ''}`)
  await invariant('หลัง cancel #3', 400)

  console.log('\n[6] notification channels')
  let n = await api('POST', '/api/admin/notifications', { type: 'line_notify', target_id: 'x' })
  check('type ไม่รู้จัก → 400', n.status === 400, String(n.status))
  n = await api('POST', '/api/admin/notifications', { type: 'line_group', target_id: 'not-a-group' })
  check('line_group groupId ผิดรูป → 400', n.status === 400, String(n.status))
  n = await api('POST', '/api/admin/notifications', { type: 'telegram', token: 'bad', target_id: '-1001234567890' })
  check('telegram token ผิดรูป → 400', n.status === 400, String(n.status))
  n = await api('POST', '/api/admin/notifications', { type: 'telegram', token: '123456789:AAFexampleTokenValue_abcdefghijklmnop', target_id: '-1001234567890' })
  if (n.status === 503) {
    check('telegram ถูกรูป แต่ prod ไม่มี NOTIFY_TOKEN_KEY → 503 พร้อมข้อความ', /NOTIFY_TOKEN_KEY/.test(n.json?.error ?? ''), n.json?.error)
  } else {
    check('telegram ถูกรูป → 201 + token_masked ไม่มี token จริง', n.status === 201 && n.json?.token_masked === '123456789:••••••••mnop' && !JSON.stringify(n.json).includes('AAFexample'), `${n.status} ${JSON.stringify(n.json).slice(0, 160)}`)
    if (n.json?.id) {
      created.channelIds.push(n.json.id)
      const t = await api('POST', `/api/admin/notifications/${n.json.id}/test`)
      check('test telegram (token ปลอม) → 502 + last_error บันทึก ไม่มี token ใน error', t.status === 502 && /Telegram 4\d\d/.test(t.json?.error ?? '') && !!t.json?.channel?.last_error && !(t.json.error + '').includes('AAFexample'), `${t.status} ${t.json?.error}`)
    }
  }
  const fakeGroup = 'C' + 'e2e5'.repeat(8)
  n = await api('POST', '/api/admin/notifications', { type: 'line_group', target_id: fakeGroup })
  check('line_group ถูกรูป → 201 + token_masked null + events default', n.status === 201 && n.json?.token_masked === null && n.json?.events?.[0] === 'redemption.created', `${n.status} ${JSON.stringify(n.json).slice(0, 160)}`)
  const chId = n.json?.id
  if (chId) {
    created.channelIds.push(chId)
    const g = await api('GET', '/api/admin/notifications')
    check('GET list เห็น channel และไม่มี field token', g.status === 200 && g.json?.some((c) => c.id === chId) && !g.json.some((c) => 'token' in c), String(g.status))
    const t = await api('POST', `/api/admin/notifications/${chId}/test`)
    check('test line_group (groupId ปลอม) → 502 (LINE ปฏิเสธ) หรือ 200 ถ้า NOTIFICATIONS_ENABLED=false บน prod', t.status === 502 || t.status === 200, `${t.status} ${t.json?.error ?? ''}`)
    console.log(`     ↳ ผลจริง: ${t.status} ${t.json?.error ?? 'ok'}`)
    let p = await api('PATCH', `/api/admin/notifications/${chId}`, { is_active: false })
    check('PATCH is_active false → 200', p.status === 200 && p.json?.is_active === false, String(p.status))
    p = await api('PATCH', `/api/admin/notifications/${chId}`, { token: '123456789:AAFexampleTokenValue_abcdefghijklmnop' })
    check('PATCH token บน line_group → 400', p.status === 400, String(p.status))
    p = await api('PATCH', `/api/admin/notifications/${chId}`, { events: ['nope'] })
    check('PATCH events ไม่รู้จัก → 400', p.status === 400, String(p.status))
    const d = await api('DELETE', `/api/admin/notifications/${chId}`)
    check('DELETE → 200', d.status === 200, String(d.status))
    if (d.status === 200) created.channelIds = created.channelIds.filter((x) => x !== chId)
    const d2 = await api('DELETE', `/api/admin/notifications/${chId}`)
    check('DELETE ซ้ำ → 404', d2.status === 404, String(d2.status))
  }

  console.log('\n[7] reconcile ทั้งระบบ')
  const rc = await sb.rpc('reconcile_balances')
  check('reconcile_balances ไม่มี drift ของลูกค้าทดสอบ', !rc.error && !(rc.data ?? []).some((x) => x.user_id === user.id), rc.error?.message)
}

main()
  .catch((e) => {
    failures.push('CRASH: ' + e.message)
    console.error('\nCRASH:', e.message)
  })
  .finally(async () => {
    await cleanup()
    console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
    for (const f of failures) console.log('  ✗ ' + f)
    process.exit(failures.length ? 1 : 0)
  })
