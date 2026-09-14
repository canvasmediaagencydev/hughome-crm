/**
 * Self-check กฎ Sprint 8 — ไม่ต้องมี DB
 *
 *   node scripts/test-sprint8-rules.mjs
 *
 * ตรวจ src/lib/redemption-status.ts (ลำดับสถานะ / ยกเลิกได้ถึง ready / รูปแบบรหัสรับของ)
 * และ src/lib/secret-box.ts (เข้ารหัส-ถอด / mask ไม่รั่ว token / ไม่มีคีย์ต้อง throw)
 * import .ts ตรง ๆ ได้เพราะ Node strip types ให้ (Node ≥ 23.6 ไม่ต้องใส่ flag)
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

// env.ts validate ตอน import — ใส่ค่า dummy ให้ครบเฉพาะรอบทดสอบนี้ (ไม่แตะ .env.local)
const TEST_KEY = 'a'.repeat(64)
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'x',
  NEXT_PUBLIC_LINE_LIFF_ID: 'x',
  NEXT_PUBLIC_TENANT_CODE: 'pilot',
  NEXT_PUBLIC_TENANT_NAME: 'x',
  NEXT_PUBLIC_TENANT_SEGMENT: 'B2B',
  NEXT_PUBLIC_TENANT_PHONE: 'x',
  NEXT_PUBLIC_TENANT_LINE_OA: 'x',
  NEXT_PUBLIC_TENANT_FB_URL: 'https://example.com',
  SUPABASE_SERVICE_ROLE_KEY: 'x',
  LINE_CHANNEL_ID: 'x',
  LINE_CHANNEL_ACCESS_TOKEN: 'x',
  CRON_SECRET: 'x',
  SESSION_SECRET: 'x',
  NOTIFY_TOKEN_KEY: TEST_KEY,
})

const rs = await import('../src/lib/redemption-status.ts')
const sb = await import('../src/lib/secret-box.ts')
const tn = await import('../src/lib/team-notify.ts')

const token = '123456789:AAFexampleTokenValue_abcdefghijklmnop'
const enc = sb.encryptSecret(token)
const enc2 = sb.encryptSecret(token)
const masked = sb.maskSecret(token)

let noKeyThrows = false
try {
  // จำลองไม่มีคีย์: serverEnv ถูก parse ไปแล้วตอน import → ทดสอบผ่าน decrypt ค่าที่ไม่ใช่ enc:v1 แทน
  sb.decryptSecret('plain-token-should-not-exist')
} catch {
  noKeyThrows = true
}

let tampered = false
try {
  sb.decryptSecret(enc.slice(0, -4) + 'AAAA')
} catch {
  tampered = true
}

const text = tn.buildRedemptionCreatedText({
  tenantName: 'สาขาทดสอบ',
  customerName: 'ลูกค้า ทดสอบ',
  phone: '0800000000',
  rewardName: 'เสื้อยืด',
  quantity: 2,
  pointsUsed: 1500,
  pickupCode: 'ABCD2345',
  adminUrl: 'https://example.com/admin/redemptions',
})

const checks = [
  // ลำดับสถานะ
  ['1. requested → approved ได้', rs.canAdvance('requested', 'approved')],
  ['2. approved → ready ได้', rs.canAdvance('approved', 'ready')],
  ['3. ready → delivered ได้', rs.canAdvance('ready', 'delivered')],
  ['4. requested → ready ข้ามขั้นไม่ได้', !rs.canAdvance('requested', 'ready')],
  ['5. requested → delivered ข้ามขั้นไม่ได้', !rs.canAdvance('requested', 'delivered')],
  ['6. delivered → อะไรก็ไม่ได้', !rs.canAdvance('delivered', 'ready') && !rs.canAdvance('delivered', 'approved')],
  ['7. cancelled → อะไรก็ไม่ได้', !rs.canAdvance('cancelled', 'approved')],
  ['8. ยกเลิกได้ที่ requested/approved/ready', ['requested', 'approved', 'ready'].every(rs.isCancellable)],
  ['9. ยกเลิกไม่ได้ที่ delivered/cancelled', !rs.isCancellable('delivered') && !rs.isCancellable('cancelled')],
  ['10. processing / shipped ไม่ใช่สถานะอีกแล้ว', !rs.isRedemptionStatus('processing') && !rs.isRedemptionStatus('shipped')],
  // รหัสรับของ
  ['11. รหัส 8 ตัวจากชุดที่อนุญาตผ่าน', rs.normalizePickupCode('ABCD2345') === 'ABCD2345'],
  ['12. พิมพ์เล็ก/เว้นวรรค/ขีด normalize ได้', rs.normalizePickupCode(' abcd-2345 ') === 'ABCD2345'],
  ['13. มี 0 / O / 1 / I ถูกปฏิเสธ', ['ABCD0345', 'ABCDO345', 'ABCD1345', 'ABCDI345'].every((c) => rs.normalizePickupCode(c) === null)],
  ['14. ยาวไม่ครบ 8 ถูกปฏิเสธ', rs.normalizePickupCode('ABCD234') === null && rs.normalizePickupCode('ABCD23456') === null],
  // secret-box
  ['15. เข้ารหัสแล้วขึ้นต้น enc:v1: และไม่มี token ใน ciphertext', enc.startsWith('enc:v1:') && !enc.includes(token.slice(10, 30))],
  ['16. เข้ารหัส 2 ครั้งได้ค่าต่างกัน (iv สุ่ม)', enc !== enc2],
  ['17. ถอดรหัสกลับได้ค่าเดิม', sb.decryptSecret(enc) === token && sb.decryptSecret(enc2) === token],
  ['18. mask โชว์ bot id + 4 ตัวท้าย ไม่โชว์ตัว token', masked === '123456789:••••••••mnop' && !masked.includes('AAFexample')],
  ['19. ค่าที่ไม่ได้เข้ารหัสใน DB ถูกปฏิเสธ (ไม่ใช้ plaintext)', noKeyThrows],
  ['20. ciphertext ถูกแก้ → ถอดไม่ผ่าน (GCM auth tag)', tampered],
  // ข้อความแจ้งทีม
  ['21. ข้อความมีครบ ชื่อ/เบอร์/ของ/แต้ม/ลิงก์/รหัส', ['ลูกค้า ทดสอบ', '0800000000', 'เสื้อยืด ×2', '1,500 แต้ม', 'https://example.com/admin/redemptions', 'ABCD2345'].every((s) => text.includes(s))],
  ['22. channel type / event ที่รู้จัก', tn.isChannelType('telegram') && tn.isChannelType('line_group') && !tn.isChannelType('line_notify') && tn.isTeamEvent('redemption.created')],
]

let pass = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`)
  if (ok) pass++
}
console.log(`\n${pass}/${checks.length} passed`)
process.exit(pass === checks.length ? 0 : 1)
