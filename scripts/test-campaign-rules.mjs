/**
 * Self-check กฎแคมเปญ (Sprint 6) — ไม่ต้องมี DB
 *
 *   node scripts/test-campaign-rules.mjs
 *
 * ตรวจ src/lib/campaigns.ts: ทับช่วง / ชนขอบ / ตัวที่ปิดไม่นับ / validation / phase
 * import .ts ตรง ๆ ได้เพราะ Node strip types ให้ (Node ≥ 23.6 ไม่ต้องใส่ flag)
 * resolve hook ด้านล่างแปล '@/…' และเติม .ts ให้ import ภายใน src/ (Node ไม่รู้จัก tsconfig paths)
 */
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      specifier = new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
    } else if (context.parentURL?.includes('/src/') && specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
      specifier += '.ts'
    }
    return nextResolve(specifier, context)
  },
})

const m = await import('../src/lib/campaigns.ts')

const A = { id: 'a', name: 'A', starts_on: '2026-07-01', ends_on: '2026-07-15', is_active: true }
const base = { name: 'x', multiplier: 1.5, starts_on: '2026-07-01', ends_on: '2026-07-15' }

const checks = [
  ['1. สร้าง 1–15 ก.ค. แล้ว 10–20 ก.ค. → ต้องถูกปฏิเสธ', !!m.findOverlapping([A], '2026-07-10', '2026-07-20')],
  ['2. 1–15 กับ 16–31 ก.ค. → ผ่าน (ชนขอบไม่ทับ)', !m.findOverlapping([A], '2026-07-16', '2026-07-31')],
  ['3. ปิดตัวแรกแล้ว 10–20 ก.ค. → ผ่าน', !m.findOverlapping([{ ...A, is_active: false }], '2026-07-10', '2026-07-20')],
  ['   PATCH ไม่นับตัวเอง', !m.findOverlapping([A], '2026-07-10', '2026-07-20', 'a')],
  ['   15–20 vs 1–15 ทับ (inclusive ทั้งคู่)', !!m.findOverlapping([A], '2026-07-15', '2026-07-20')],
  ['   ข้อความบอกชื่อตัวที่ทับ', m.overlapMessage(A).includes('"A"')],
  ['validate: ครบ → ok', m.validateCampaignFields(base).ok],
  ['validate: ends < starts → ปฏิเสธ', !m.validateCampaignFields({ ...base, starts_on: '2026-07-15', ends_on: '2026-07-01' }).ok],
  ['validate: ทศนิยม 3 ตำแหน่ง → ปฏิเสธ', !m.validateCampaignFields({ ...base, multiplier: 1.555 }).ok],
  ['validate: ตัวคูณ 0 → ปฏิเสธ', !m.validateCampaignFields({ ...base, multiplier: 0 }).ok],
  ['validate: ตัวคูณ 100 → ปฏิเสธ (numeric(4,2))', !m.validateCampaignFields({ ...base, multiplier: 100 }).ok],
  ['validate: 2026-02-30 ไม่ใช่วันจริง', !m.isIsoDate('2026-02-30')],
  ['validate: PATCH ส่งแค่ is_active → ok', m.validateCampaignFields({ is_active: false }, true).ok],
  ['validate: PATCH ว่าง → ไม่มี field', Object.keys(m.validateCampaignFields({}, true).value ?? {}).length === 0],
  ['phase: running', m.campaignPhase({ ...A, starts_on: '2026-08-15', ends_on: '2026-12-31' }, '2026-09-13') === 'running'],
  ['phase: ended', m.campaignPhase(A, '2026-09-13') === 'ended'],
  ['phase: upcoming', m.campaignPhase({ ...A, starts_on: '2026-10-01', ends_on: '2026-10-31' }, '2026-09-13') === 'upcoming'],
  ['phase: inactive ชนะทุกอย่าง', m.campaignPhase({ ...A, is_active: false }, '2026-07-10') === 'inactive'],
]

let pass = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${label}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} ผ่าน`)
process.exit(pass === checks.length ? 0 : 1)
