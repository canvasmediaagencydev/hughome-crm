/**
 * สถานะใบแลกรางวัล 4 ขั้น + ยกเลิก (MIGRATION_PLAN.md §4.3, §6.2 · Sprint 8)
 *
 *   requested → approved → ready → delivered
 *        └────────┴─────────┴──→ cancelled   (คืนแต้ม+สต็อกผ่าน RPC cancel_redemption)
 *
 * ไฟล์นี้ import ได้ทั้ง client และ server — ห้ามใส่ของฝั่ง server
 * ค่า enum ตรงกับ Database["public"]["Enums"]["redemption_status"] (001) —
 * processing / shipped ของระบบเก่าไม่มีอีกแล้ว
 */
import type { Database } from '../../database.types'

export type RedemptionStatus = Database['public']['Enums']['redemption_status']

export const REDEMPTION_STATUSES: readonly RedemptionStatus[] = [
  'requested',
  'approved',
  'ready',
  'delivered',
  'cancelled',
] as const

export const REDEMPTION_STATUS_LABEL: Record<RedemptionStatus, string> = {
  requested: 'รอดำเนินการ',
  approved: 'อนุมัติแล้ว',
  ready: 'พร้อมรับของ',
  delivered: 'รับของแล้ว',
  cancelled: 'ยกเลิก',
}

/** ข้อความฝั่งลูกค้า — บอกว่าต้องทำอะไรต่อ */
export const REDEMPTION_STATUS_CUSTOMER_HINT: Record<RedemptionStatus, string> = {
  requested: 'ร้านกำลังตรวจสอบคำขอ',
  approved: 'ร้านกำลังเตรียมของ',
  ready: 'มารับได้ที่หน้าร้าน แสดง QR ที่เคาน์เตอร์',
  delivered: 'รับของเรียบร้อยแล้ว',
  cancelled: 'ยกเลิกแล้ว แต้มคืนเข้าบัญชีแล้ว',
}

/** ขั้นถัดไปที่กดจากหน้าแอดมินได้ (เดินหน้าทีละขั้น ห้ามข้าม) */
export const NEXT_STATUS: Partial<Record<RedemptionStatus, RedemptionStatus>> = {
  requested: 'approved',
  approved: 'ready',
  ready: 'delivered',
}

/** สถานะที่ยังยกเลิกได้ — ตรงกับเงื่อนไขใน RPC cancel_redemption (021) */
export const CANCELLABLE: readonly RedemptionStatus[] = ['requested', 'approved', 'ready']

export function isRedemptionStatus(v: unknown): v is RedemptionStatus {
  return typeof v === 'string' && (REDEMPTION_STATUSES as readonly string[]).includes(v)
}

export function isCancellable(status: RedemptionStatus): boolean {
  return CANCELLABLE.includes(status)
}

/** เดินหน้าจาก from → to ได้ไหม (ทีละขั้นเท่านั้น) */
export function canAdvance(from: RedemptionStatus, to: RedemptionStatus): boolean {
  return NEXT_STATUS[from] === to
}

/** รูปแบบรหัสรับของที่ generate_pickup_code() ออกให้ (023): 8 ตัวจาก A-Z (ไม่มี O I) 2-9 (ไม่มี 0 1) */
export const PICKUP_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/

/** รับได้ทั้งพิมพ์เล็ก/เว้นวรรค/ขีด — คืน null ถ้าไม่เข้ารูปแบบ */
export function normalizePickupCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, '')
  return PICKUP_CODE_RE.test(code) ? code : null
}
