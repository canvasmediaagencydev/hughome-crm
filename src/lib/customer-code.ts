/**
 * รหัสลูกค้า (user_profiles.customer_code) — Q1 ตอบ 2026-09-21:
 *   รหัสมาจากระบบเดิมของร้าน ไม่ generate เอง · ใช้ค้นหาและจับคู่กับเบอร์ที่สมัคร
 * Feedback ลูกค้า 2026-10-18: "ไม่ล็อกรูปแบบ" — รับรหัสรูปแบบใดก็ได้ (เช่น LP80ลก-024, 10297, AR-10297)
 *   เหลือแค่กันค่าที่ใช้ไม่ได้จริง: ว่าง, ยาวเกิน 64 ตัว, มีอักขระควบคุม
 * client- และ server-safe (ไม่ import อะไรที่เป็น server-only)
 */
export const CUSTOMER_CODE_MAX_LEN = 64

export function normalizeCustomerCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  // exceljs อาจคืนตัวเลขเป็น number → เอาแบบไม่มีทศนิยม · ตัดช่องว่าง
  const s = typeof raw === 'number' ? String(Math.trunc(raw)) : String(raw).trim()
  return s === '' ? null : s
}

export function isValidCustomerCode(code: string): boolean {
  // eslint-disable-next-line no-control-regex
  return code.length >= 1 && code.length <= CUSTOMER_CODE_MAX_LEN && !/[\u0000-\u001f\u007f]/.test(code)
}

export const CUSTOMER_CODE_FORMAT_HINT = `รูปแบบใดก็ได้ ไม่เกิน ${CUSTOMER_CODE_MAX_LEN} ตัวอักษร และไม่มีอักขระพิเศษที่มองไม่เห็น`
