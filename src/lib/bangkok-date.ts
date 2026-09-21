/**
 * วันที่แบบ 'YYYY-MM-DD' ตาม Asia/Bangkok — ใช้ร่วมกันทุก cron / RPC call
 * (RPC ฝั่ง DB ใช้ (now() AT TIME ZONE 'Asia/Bangkok')::date — ต้องตรงกัน)
 * ไม่ import อะไรที่เป็น server-only · ใช้ได้ทั้ง client/server
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** วันนี้ตาม Asia/Bangkok */
export function todayBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now)
}

/** 'YYYY-MM-DD' ที่เป็นวันจริง (ไม่รับ 2026-02-30) */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** บวกวัน (คำนวณแบบ UTC บน ISO date จึงไม่โดน DST/timezone) */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** บวกเดือน — ถ้าวันเกินเดือนปลายทาง (31 ม.ค. + 1 เดือน) จะถอยมาวันสุดท้ายของเดือนนั้น */
export function addMonths(iso: string, months: number): string {
  const [y, m, day] = iso.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(day, lastDay))
  return first.toISOString().slice(0, 10)
}

/** จำนวนวันจาก a ถึง b (b - a) */
export function daysBetween(a: string, b: string): number {
  const ms = Date.UTC(...splitIso(b)) - Date.UTC(...splitIso(a))
  return Math.round(ms / 86_400_000)
}

function splitIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m - 1, d]
}

/** ISO timestamp (เช่น created_at) → 'YYYY-MM-DD' ตามเวลาไทย · ค่าที่อ่านไม่ออกคืน null */
export function bangkokDateOf(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return null
  return todayBangkok(d)
}

/** 23 ก.ค. 2569 */
export function formatThaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** กรกฎาคม 2569 — สำหรับ "แต้มจะหมดอายุ [เดือน]" */
export function formatThaiMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
