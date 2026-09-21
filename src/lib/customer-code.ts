/**
 * รหัสลูกค้า (user_profiles.customer_code) — Q1 ตอบ 2026-09-21:
 *   รหัสมาจากระบบเดิมของร้าน (export เป็นตัวเลข) ไม่ generate เอง · ใช้ค้นหาและจับคู่กับเบอร์ที่สมัคร
 * ยอมรับ: ตัวเลขล้วน (ระบบเดิม) · รูปแบบเก่าที่เคยรับไว้ (AR-10297, 50ลส-1030) ยังรับได้ ไม่ทำแถวเก่าพัง
 * client- และ server-safe (ไม่ import อะไรที่เป็น server-only)
 */
export const CUSTOMER_CODE_RE = /^(\d{1,20}|[A-Za-z]{2}-\d+|\d+[A-Za-zก-๙]+-\d+)$/

export function normalizeCustomerCode(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  // exceljs อาจคืนตัวเลขเป็น number → เอาแบบไม่มีทศนิยม · ตัดช่องว่าง
  const s = typeof raw === 'number' ? String(Math.trunc(raw)) : String(raw).trim()
  return s === '' ? null : s
}

export function isValidCustomerCode(code: string): boolean {
  return CUSTOMER_CODE_RE.test(code)
}

export const CUSTOMER_CODE_FORMAT_HINT = 'ตัวเลขจากระบบเดิม เช่น 10297 (หรือรูปแบบเก่า AR-10297 / 50ลส-1030)'
