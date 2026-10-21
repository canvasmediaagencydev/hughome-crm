/**
 * Thai phone normalization — single canonical format across the whole system.
 *
 * CANONICAL = local 10-digit `0xxxxxxxxx` (starts 0 + [689]).
 * Reason: the weekly Excel batch upload matches customers by phone using exactly
 * this format (MIGRATION_PLAN.md §12: "auto-fix 8xx → 08xx", "10 หลักขึ้นต้น 0[689]").
 * Points flow through phone matching, so identity is stored/compared in this one
 * format everywhere. E.164 (+66) is used ONLY as transport when calling Supabase
 * Auth (which requires it) — never as the stored identity.
 */

/** → '0xxxxxxxxx' or null if not a valid Thai mobile number. */
export function normalizeThaiPhone(input: string | null | undefined): string | null {
  if (!input) return null
  let d = String(input).replace(/\D/g, '')
  if (d.startsWith('66')) d = '0' + d.slice(2) // +66xxxxxxxxx → 0xxxxxxxxx
  else if (d.length === 9 && /^[689]/.test(d)) d = '0' + d // 8xxxxxxxx → 08xxxxxxxx
  return /^0[689]\d{8}$/.test(d) ? d : null
}

/** → '+66xxxxxxxxx' (for Supabase Auth) or null if invalid. */
export function toE164Thai(input: string | null | undefined): string | null {
  const local = normalizeThaiPhone(input)
  return local ? '+66' + local.slice(1) : null
}

/**
 * เบอร์สำหรับแสดงผล → 'xxx-xxxxxxx' ทั้งระบบ (ประชุมลูกค้า 2026-10-21 · รูปแบบเดียวกับ reportPhone ใน
 * build-reports.js). ไม่ใช่ 10 หลัก → คืนตามที่เก็บ ไม่เดารูปแบบ · ว่าง → ''
 * ใช้แสดงเท่านั้น — เก็บ/เทียบยังเป็น 10 หลักติดกันเสมอ (normalizeThaiPhone)
 */
export function formatThaiPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = String(phone).replace(/\D/g, '')
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : String(phone)
}

/**
 * ช่องกรอกเบอร์ → ใส่ขีดให้ระหว่างพิมพ์ ('0812' → '081-2', ครบ → '081-2345678')
 * รับเฉพาะตัวเลขสูงสุด 10 หลัก · ฝั่ง server normalize ด้วย normalizeThaiPhone อยู่แล้ว ขีดไม่มีผล
 */
export function formatThaiPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  return digits.length > 3 ? `${digits.slice(0, 3)}-${digits.slice(3)}` : digits
}
