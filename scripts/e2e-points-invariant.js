/**
 * ทดสอบ invariant ของแต้มบน Supabase จริง (Sprint 7 self-check):
 *
 *   user_profiles.points_balance == SUM(point_batch_ledger.points_remaining)
 *
 * หลังทุกขั้น: adjust +  →  redeem (FIFO ข้าม lot หมดอายุ)  →  expire  →  cancel redemption  →  adjust −
 *
 *   node scripts/e2e-points-invariant.js --yes
 *
 * ⚠️ เขียนลง DB จริง · สร้างลูกค้า+รางวัลทดสอบของตัวเอง (line_user_id ขึ้นต้น E2E-INV-)
 *    และลบทุกอย่างที่สร้างทิ้งตอนจบ (รวมกรณี error)
 * ⚠️ ขั้น "expire" เรียก RPC expire_ledger_batches(วันนี้) ซึ่งเป็นสิ่งที่ cron รายวันทำอยู่แล้ว
 *    lot ของลูกค้าจริงที่เลยวันหมดอายุ (ถ้ามี) จะถูกตัดจริงในขั้นนี้ — จึงต้องใส่ --yes
 *
 * ต้องมี admin_users ที่ is_active อย่างน้อย 1 คน (cancel_redemption ตรวจ p_admin)
 */
require('dotenv').config({ path: '.env.local', quiet: true })
const { createClient } = require('@supabase/supabase-js')

if (!process.argv.includes('--yes')) {
  console.error('สคริปต์นี้เขียน DB จริง (รวม expire_ledger_batches วันนี้) — ใส่ --yes เพื่อยืนยัน')
  process.exit(2)
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const TAG = 'E2E-INV-' + Date.now()
const created = { userId: null, rewardId: null }
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
const todayBangkok = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

async function snapshot() {
  const [{ data: u }, { data: lots }] = await Promise.all([
    sb.from('user_profiles').select('points_balance').eq('id', created.userId).single(),
    sb.from('point_batch_ledger').select('id, points_remaining, expires_at, source').eq('user_id', created.userId),
  ])
  const ledger = (lots ?? []).reduce((s, l) => s + l.points_remaining, 0)
  return { balance: u.points_balance, ledger, lots: lots ?? [] }
}
async function invariant(step, expectedBalance) {
  const s = await snapshot()
  check(`${step}: balance ${s.balance} == ledger ${s.ledger}`, s.balance === s.ledger)
  if (expectedBalance !== undefined) check(`${step}: balance = ${expectedBalance}`, s.balance === expectedBalance, String(s.balance))
  return s
}

async function cleanup() {
  if (created.userId) {
    const { data: reds } = await sb.from('redemptions').select('id').eq('user_id', created.userId)
    for (const r of reds ?? []) await sb.from('redemption_lots').delete().eq('redemption_id', r.id)
    await sb.from('redemptions').delete().eq('user_id', created.userId)
    await sb.from('notification_log').delete().eq('user_id', created.userId)
    await sb.from('point_transactions').delete().eq('user_id', created.userId)
    await sb.from('point_batch_ledger').delete().eq('user_id', created.userId)
    await sb.from('user_profiles').delete().eq('id', created.userId)
  }
  if (created.rewardId) await sb.from('rewards').delete().eq('id', created.rewardId)
  // เก็บกวาดรอบก่อนที่อาจค้าง
  const { data: stale } = await sb.from('user_profiles').select('id').like('line_user_id', 'E2E-INV-%')
  for (const u of stale ?? []) {
    await sb.from('point_transactions').delete().eq('user_id', u.id)
    await sb.from('point_batch_ledger').delete().eq('user_id', u.id)
    await sb.from('user_profiles').delete().eq('id', u.id)
  }
}

async function main() {
  const { data: admin } = await sb.from('admin_users').select('id').eq('is_active', true).limit(1).single()
  if (!admin) throw new Error('ไม่มี admin_users ที่ is_active')

  console.log('[0] fixtures')
  const { data: user, error: uErr } = await sb
    .from('user_profiles')
    .insert({ line_user_id: TAG, phone: '09' + String(Date.now()).slice(-8), birthday: '1990-01-01', first_name: 'ลูกค้า', last_name: 'ทดสอบ INV', role: 'homeowner' })
    .select()
    .single()
  if (uErr) throw new Error('สร้าง user ไม่ได้: ' + uErr.message)
  created.userId = user.id
  const { data: reward, error: rErr } = await sb
    .from('rewards')
    .insert({ name: TAG + ' reward', points_cost: 150, stock_quantity: 5 })
    .select()
    .single()
  if (rErr) throw new Error('สร้าง reward ไม่ได้: ' + rErr.message)
  created.rewardId = reward.id
  await invariant('เริ่มต้น', 0)

  console.log('\n[1] adjust_points_manual +300 → lot A (อายุ ~1 ปี)')
  const a1 = await sb.rpc('adjust_points_manual', { p_user: user.id, p_delta: 300, p_admin: admin.id, p_note: 'e2e +300' })
  check('RPC คืน balance 300', a1.data === 300, a1.error?.message ?? String(a1.data))
  let s = await invariant('หลัง +300', 300)
  check('มี lot manual 1 ก้อน 300', s.lots.length === 1 && s.lots[0].points_remaining === 300)

  console.log('\n[2] fixture: lot B 100 แต้ม หมดอายุเมื่อวาน (insert ตรง — fixture เท่านั้น)')
  const yesterday = addDays(todayBangkok(), -1)
  const { error: bErr } = await sb.from('point_batch_ledger').insert({
    user_id: user.id, source: 'manual', points_earned: 100, points_remaining: 100,
    earned_month: yesterday.slice(0, 7) + '-01', expires_at: yesterday, multiplier: 1,
  })
  if (bErr) throw new Error('insert lot B ไม่ได้: ' + bErr.message)
  await sb.from('user_profiles').update({ points_balance: 400 }).eq('id', user.id)
  await invariant('หลังใส่ lot B', 400)

  console.log('\n[3] redeem_reward 150 → ต้องหักจาก lot A เท่านั้น (B หมดอายุแล้ว ข้าม)')
  const r1 = await sb.rpc('redeem_reward', { p_user: user.id, p_reward: reward.id, p_qty: 1 })
  check('redeem สำเร็จ', !r1.error && typeof r1.data === 'string', r1.error?.message)
  const redemptionId = r1.data
  s = await invariant('หลัง redeem', 250)
  const lotA = s.lots.find((l) => l.expires_at !== yesterday)
  const lotB = s.lots.find((l) => l.expires_at === yesterday)
  check('lot A เหลือ 150 · lot B ยังเป็น 100 (ไม่โดนหัก)', lotA?.points_remaining === 150 && lotB?.points_remaining === 100,
    `A=${lotA?.points_remaining} B=${lotB?.points_remaining}`)
  const { data: rl } = await sb.from('redemption_lots').select('lot_id, points').eq('redemption_id', redemptionId)
  check('redemption_lots จดว่าหักจาก A 150', rl?.length === 1 && rl[0].lot_id === lotA?.id && rl[0].points === 150, JSON.stringify(rl))
  const { data: rw } = await sb.from('rewards').select('stock_quantity').eq('id', reward.id).single()
  check('สต็อกลดเหลือ 4', rw.stock_quantity === 4, String(rw.stock_quantity))

  console.log('\n[4] expire_ledger_batches(วันนี้) → lot B หมดอายุ')
  const e1 = await sb.rpc('expire_ledger_batches', { p_as_of: todayBangkok() })
  check('RPC สำเร็จ (ตัดรวมทั้งระบบ ' + e1.data + ' แต้ม — ของทดสอบ 100 ในนั้น)', !e1.error && e1.data >= 100, e1.error?.message ?? String(e1.data))
  s = await invariant('หลัง expire', 150)
  check('lot B = 0 แต่แถวยังอยู่ (ประวัติ)', s.lots.find((l) => l.expires_at === yesterday)?.points_remaining === 0)
  const { data: tx } = await sb.from('point_transactions').select('type, points').eq('user_id', user.id).eq('type', 'expired')
  check("มี point_transactions 'expired' -100", tx?.length === 1 && tx[0].points === -100, JSON.stringify(tx))

  console.log('\n[5] cancel_redemption → คืน 150 เข้า lot A · สต็อกคืน')
  const c1 = await sb.rpc('cancel_redemption', { p_redemption: redemptionId, p_admin: admin.id, p_note: 'e2e cancel' })
  check('RPC คืน balance 300', c1.data === 300, c1.error?.message ?? String(c1.data))
  s = await invariant('หลัง cancel', 300)
  check('lot A กลับเป็น 300', s.lots.find((l) => l.expires_at !== yesterday)?.points_remaining === 300)
  const { data: red } = await sb.from('redemptions').select('status, processed_by').eq('id', redemptionId).single()
  check('redemption = cancelled · processed_by = admin', red.status === 'cancelled' && red.processed_by === admin.id)
  const { data: rw2 } = await sb.from('rewards').select('stock_quantity').eq('id', reward.id).single()
  check('สต็อกกลับเป็น 5', rw2.stock_quantity === 5, String(rw2.stock_quantity))
  const c2 = await sb.rpc('cancel_redemption', { p_redemption: redemptionId, p_admin: admin.id, p_note: 'twice' })
  check('cancel ซ้ำถูกปฏิเสธ', !!c2.error, c2.error ? '' : 'ไม่ error')
  await invariant('หลัง cancel ซ้ำ', 300)

  console.log('\n[6] adjust_points_manual −50 → หัก FIFO จาก lot A')
  const a2 = await sb.rpc('adjust_points_manual', { p_user: user.id, p_delta: -50, p_admin: admin.id, p_note: 'e2e -50' })
  check('RPC คืน balance 250', a2.data === 250, a2.error?.message ?? String(a2.data))
  await invariant('หลัง −50', 250)
  const a3 = await sb.rpc('adjust_points_manual', { p_user: user.id, p_delta: -999, p_admin: admin.id, p_note: 'e2e overdraw' })
  check('หักเกิน balance ถูกปฏิเสธ', !!a3.error)
  await invariant('หลังหักเกิน (ไม่เปลี่ยน)', 250)

  console.log('\n[7] reconcile_balances() ทั้งระบบ')
  const rc = await sb.rpc('reconcile_balances')
  check('RPC สำเร็จ', !rc.error, rc.error?.message)
  const mine = (rc.data ?? []).filter((r) => r.user_id === user.id)
  check('ลูกค้าทดสอบไม่อยู่ในรายการ drift', mine.length === 0)
  if ((rc.data ?? []).length > 0) console.log('  ⚠️ ระบบมี drift อยู่ ' + rc.data.length + ' คน (ไม่ใช่ของทดสอบ):', JSON.stringify(rc.data))
}

main()
  .catch((e) => {
    failures.push('EXCEPTION: ' + e.message)
    console.error('\n💥', e.message)
  })
  .finally(async () => {
    await cleanup()
    console.log(`\n${pass} ผ่าน · ${failures.length} ตก`)
    if (failures.length) {
      console.log('ที่ตก:')
      for (const f of failures) console.log('  · ' + f)
    }
    process.exit(failures.length ? 1 : 0)
  })
