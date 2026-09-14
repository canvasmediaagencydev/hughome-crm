/**
 * Campaign (ตัวคูณแต้มผูกช่วงวันที่) — validation + แปล error ให้อ่านรู้เรื่อง
 *
 * ใช้ร่วมกันระหว่าง /api/admin/campaigns (server) และ /admin/campaigns (client)
 * ห้าม import อะไรที่เป็น server-only ที่นี่
 *
 * กติกา (migration 014):
 *   multiplier numeric(4,2) > 0 → ทศนิยม 2 ตำแหน่ง สูงสุด 99.99
 *   ends_on >= starts_on (inclusive ทั้งคู่)
 *   name 1–120 ตัวอักษร
 *   campaign ที่ is_active ห้ามซ้อนช่วง — DB บังคับด้วย EXCLUDE point_campaigns_no_overlap (23P01)
 */

import { isIsoDate, formatThaiDate, todayBangkok } from '@/lib/bangkok-date'

export interface CampaignRange {
  id: string
  name: string
  starts_on: string
  ends_on: string
  is_active: boolean
}

export interface CampaignInput {
  name: string
  description: string | null
  multiplier: number
  starts_on: string
  ends_on: string
  is_active: boolean
}

export { isIsoDate, formatThaiDate, todayBangkok }

export function formatRange(starts_on: string, ends_on: string): string {
  return `${formatThaiDate(starts_on)} – ${formatThaiDate(ends_on)}`
}

/**
 * ตรวจ field ทีละตัว คืน error ข้อความไทยข้อแรกที่เจอ หรือ null ถ้าผ่าน
 * `partial` = PATCH (field ที่ไม่ส่งมาไม่ตรวจ)
 */
export function validateCampaignFields(
  body: Record<string, unknown>,
  partial = false
): { ok: true; value: Partial<CampaignInput> } | { ok: false; error: string } {
  const value: Partial<CampaignInput> = {}

  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim()
    if (name.length < 1 || name.length > 120) return { ok: false, error: 'ชื่อแคมเปญต้องยาว 1–120 ตัวอักษร' }
    value.name = name
  }

  if (body.description !== undefined) {
    const desc = body.description === null ? '' : String(body.description).trim()
    if (desc.length > 500) return { ok: false, error: 'คำอธิบายยาวได้ไม่เกิน 500 ตัวอักษร' }
    value.description = desc || null
  }

  if (!partial || body.multiplier !== undefined) {
    const m = Number(body.multiplier)
    if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'ตัวคูณต้องเป็นตัวเลขมากกว่า 0' }
    if (m > 99.99) return { ok: false, error: 'ตัวคูณสูงสุด 99.99' }
    if (Math.round(m * 100) !== m * 100) return { ok: false, error: 'ตัวคูณใช้ทศนิยมได้ไม่เกิน 2 ตำแหน่ง' }
    value.multiplier = m
  }

  if (!partial || body.starts_on !== undefined) {
    if (!isIsoDate(body.starts_on)) return { ok: false, error: 'วันเริ่มต้นไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)' }
    value.starts_on = body.starts_on
  }
  if (!partial || body.ends_on !== undefined) {
    if (!isIsoDate(body.ends_on)) return { ok: false, error: 'วันสิ้นสุดไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)' }
    value.ends_on = body.ends_on
  }
  if (value.starts_on && value.ends_on && value.ends_on < value.starts_on) {
    return { ok: false, error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' }
  }

  if (body.is_active !== undefined) value.is_active = Boolean(body.is_active)

  return { ok: true, value }
}

/** ช่วง inclusive สองช่วงทับกันไหม (ชนขอบพอดี = ทับ เพราะ daterange '[]') */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/** หา campaign ที่ active และทับช่วงที่ให้มา (ข้าม excludeId = ตัวเองตอน PATCH) */
export function findOverlapping<T extends CampaignRange>(
  campaigns: T[],
  starts_on: string,
  ends_on: string,
  excludeId?: string
): T | null {
  for (const c of campaigns) {
    if (!c.is_active) continue
    if (excludeId && c.id === excludeId) continue
    if (rangesOverlap(starts_on, ends_on, c.starts_on, c.ends_on)) return c
  }
  return null
}

/** ข้อความสำหรับ 23P01 / pre-check — บอกชื่อและช่วงของตัวที่ทับ */
export function overlapMessage(conflict: CampaignRange): string {
  return `ช่วงวันที่ทับกับแคมเปญ "${conflict.name}" (${formatRange(conflict.starts_on, conflict.ends_on)}) — แคมเปญที่เปิดใช้งานห้ามซ้อนช่วงกัน ปิดตัวเดิมหรือเลื่อนวันก่อน`
}

/** สถานะแสดงผลของ campaign เทียบกับวันนี้ (Asia/Bangkok) */
export type CampaignPhase = 'inactive' | 'upcoming' | 'running' | 'ended'

export function campaignPhase(c: CampaignRange, today: string): CampaignPhase {
  if (!c.is_active) return 'inactive'
  if (today < c.starts_on) return 'upcoming'
  if (today > c.ends_on) return 'ended'
  return 'running'
}
