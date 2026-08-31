/**
 * แก้ demo data drift บนฐาน pilot ให้กลับมาตรงกับไฟล์สาธิตใน docs/demo/
 *
 *   node scripts/repair-demo-data.js --dry     (ดูอย่างเดียว ไม่เขียน)
 *   node scripts/repair-demo-data.js           (เขียนจริง)
 *
 * ที่มา: seed_mockdata50_customers.sql ถูกรันทับ seed_demo_data.sql แล้ว
 *   - ขยายแคมเปญ x2 จาก 2026-07-23 เป็น 2026-07-15 → ไฟล์สาธิตกลายเป็น 874 แต้ม (ควรได้ 687)
 *   - เพิ่มพนักงาน S029 และลูกค้า Udemo50-% สำหรับไฟล์ 50 แถวที่ไม่มีอยู่ในรีโปแล้ว
 *   - ไม่มีแคมเปญไหนครอบวันนี้ (ทั้งสองช่วงจบก่อนวันปัจจุบัน)
 *
 * สคริปต์นี้ทำ 3 อย่าง (idempotent รันซ้ำได้):
 *   1. คืนช่วงแคมเปญ x2 เป็น 2026-07-23 → 2026-08-05
 *   2. เพิ่มแคมเปญสาธิตที่กำลังดำเนินอยู่ (x1.5 · 2026-08-15 → 2026-12-31)
 *   3. ลบข้อมูลของ mock50 (S029 + ลูกค้า Udemo50-%) — ข้ามถ้ามี ledger อ้างถึง
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const DRY = process.argv.includes('--dry')

const CAMPAIGN_X2 = { name: 'ฮักโฮมกลางปี รับแต้ม 2 เท่า', starts_on: '2026-07-23', ends_on: '2026-08-05' }
const CAMPAIGN_NOW = {
  name: 'ฮักโฮมปลายฝน รับแต้ม 1.5 เท่า',
  description: 'แคมเปญสาธิต (กำลังดำเนินอยู่)',
  multiplier: 1.5,
  starts_on: '2026-08-15',
  ends_on: '2026-12-31',
  is_active: true,
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const die = (label, error) => {
  if (error) {
    console.error(`ERROR ${label}: ${error.message}`)
    process.exit(1)
  }
}

async function main() {
  console.log('ฐาน:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (DRY) console.log('โหมด --dry · ไม่เขียนอะไรลงฐาน\n')

  // ---- 1. คืนช่วงแคมเปญ x2 ----
  const { data: x2, error: e1 } = await sb
    .from('point_campaigns')
    .select('id, starts_on, ends_on')
    .eq('name', CAMPAIGN_X2.name)
    .maybeSingle()
  die('อ่านแคมเปญ x2', e1)

  if (!x2) {
    console.log(`[1] ไม่พบแคมเปญ "${CAMPAIGN_X2.name}" — ข้าม (ต้องรัน seed_demo_data.sql ก่อน)`)
  } else if (x2.starts_on === CAMPAIGN_X2.starts_on && x2.ends_on === CAMPAIGN_X2.ends_on) {
    console.log('[1] ช่วงแคมเปญ x2 ถูกต้องอยู่แล้ว')
  } else {
    console.log(`[1] แคมเปญ x2: ${x2.starts_on} → ${x2.ends_on}  ปรับเป็น  ${CAMPAIGN_X2.starts_on} → ${CAMPAIGN_X2.ends_on}`)
    if (!DRY) {
      const { error } = await sb
        .from('point_campaigns')
        .update({ starts_on: CAMPAIGN_X2.starts_on, ends_on: CAMPAIGN_X2.ends_on })
        .eq('id', x2.id)
      die('ปรับแคมเปญ x2', error)
    }
  }

  // ---- 2. แคมเปญที่กำลังดำเนินอยู่ ----
  const { data: now, error: e2 } = await sb
    .from('point_campaigns')
    .select('id, starts_on, ends_on')
    .eq('name', CAMPAIGN_NOW.name)
    .maybeSingle()
  die('อ่านแคมเปญปัจจุบัน', e2)

  if (now) {
    console.log(`[2] แคมเปญปัจจุบันมีอยู่แล้ว: ${now.starts_on} → ${now.ends_on}`)
  } else {
    console.log(`[2] เพิ่มแคมเปญ "${CAMPAIGN_NOW.name}" x${CAMPAIGN_NOW.multiplier} · ${CAMPAIGN_NOW.starts_on} → ${CAMPAIGN_NOW.ends_on}`)
    if (!DRY) {
      const { error } = await sb.from('point_campaigns').insert(CAMPAIGN_NOW)
      die('เพิ่มแคมเปญปัจจุบัน', error) // 23P01 = ช่วงทับกับแคมเปญอื่น
    }
  }

  // ---- 3. ลบข้อมูล mock50 ----
  const { data: mockUsers, error: e3 } = await sb
    .from('user_profiles')
    .select('id, phone, points_balance')
    .like('line_user_id', 'Udemo50-%')
  die('อ่านลูกค้า mock50', e3)

  if (!mockUsers.length) {
    console.log('[3] ไม่มีลูกค้า Udemo50-% เหลืออยู่')
  } else {
    const ids = mockUsers.map((u) => u.id)
    const { data: refs, error: e4 } = await sb.from('point_batch_ledger').select('id').in('user_id', ids).limit(1)
    die('ตรวจ ledger ของลูกค้า mock50', e4)
    if (refs.length) {
      console.log(`[3] ลูกค้า Udemo50-% ${mockUsers.length} คนมี ledger อ้างถึง — ไม่ลบ (ต้อง void batch ก่อน)`)
    } else {
      console.log(`[3] ลบลูกค้า Udemo50-% ${mockUsers.length} คน`)
      if (!DRY) {
        const { error: e5 } = await sb.from('point_transactions').delete().in('user_id', ids)
        die('ลบ point_transactions ของ mock50', e5)
        const { error: e6 } = await sb.from('user_profiles').delete().in('id', ids)
        die('ลบลูกค้า mock50', e6)
      }
    }
  }

  const { data: rep, error: e7 } = await sb.from('sales_reps').select('id, code').ilike('code', 'S029').maybeSingle()
  die('อ่านพนักงาน S029', e7)

  if (!rep) {
    console.log('[4] ไม่มีพนักงาน S029')
  } else {
    const { data: repRefs, error: e8 } = await sb.from('point_batch_ledger').select('id').eq('sales_rep_id', rep.id).limit(1)
    die('ตรวจ ledger ของ S029', e8)
    if (repRefs.length) {
      console.log('[4] พนักงาน S029 มี ledger อ้างถึง — ไม่ลบ')
    } else {
      console.log('[4] ลบพนักงาน S029')
      if (!DRY) {
        const { error } = await sb.from('sales_reps').delete().eq('id', rep.id)
        die('ลบ S029', error)
      }
    }
  }

  console.log(DRY ? '\nจบ (dry run) — รันซ้ำโดยไม่ใส่ --dry เพื่อเขียนจริง' : '\nเสร็จ — ตรวจต่อด้วย: node scripts/verify-demo-ready.js')
}

main().catch((e) => {
  console.error('\nERROR:', e.message)
  process.exit(1)
})
