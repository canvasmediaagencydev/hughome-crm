/**
 * Server helpers ของ /api/admin/notifications — route.ts export ได้แค่ HTTP handler
 *
 * token (Telegram bot) เป็น credential เต็มรูปแบบ (§9.5):
 *   เข้ารหัสก่อนเก็บ (secret-box) · GET คืนแค่ mask · ไม่ log
 */
import { encryptSecret, decryptSecret, maskSecret } from '@/lib/secret-box'
import { CREATABLE_CHANNEL_TYPES, TEAM_EVENTS, isTeamEvent, type NotificationChannel } from '@/lib/team-notify'

/** รูปที่ส่งออกให้ client — ไม่มี token จริง */
export interface PublicChannel {
  id: string
  type: string
  target_id: string
  events: string[]
  is_active: boolean
  last_error: string | null
  last_sent_at: string | null
  created_at: string
  updated_at: string
  /** `123456789:••••••••abcd` · null สำหรับ line_group หรือถอดรหัสไม่ได้ */
  token_masked: string | null
}

export function toPublic(ch: NotificationChannel): PublicChannel {
  let token_masked: string | null = null
  if (ch.token) {
    try {
      token_masked = maskSecret(decryptSecret(ch.token))
    } catch {
      // คีย์เปลี่ยน/ไม่มีคีย์ → บอกว่าถอดไม่ได้ ไม่โยนทั้ง GET ล้ม
      token_masked = '(ถอดรหัสไม่ได้ — กรอก token ใหม่)'
    }
  }
  return {
    id: ch.id,
    type: ch.type,
    target_id: ch.target_id,
    events: ch.events,
    is_active: ch.is_active,
    last_error: ch.last_error,
    last_sent_at: ch.last_sent_at,
    created_at: ch.created_at,
    updated_at: ch.updated_at,
    token_masked,
  }
}

// Telegram bot token: `<bot id>:<35 ตัว>` · chat id ของกลุ่ม: ตัวเลข มักติดลบ (-100...)
const TELEGRAM_TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TELEGRAM_CHAT_RE = /^-?\d{4,20}$/
// LINE groupId ขึ้นต้น C + 32 hex
const LINE_GROUP_RE = /^C[0-9a-f]{32}$/

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export interface ChannelInsert {
  type: string
  target_id: string
  events: string[]
  is_active: boolean
  token: string | null
}

/** ตรวจ body ของ POST — คืนแถวพร้อม insert (token เข้ารหัสแล้ว) */
export function validateCreate(body: Record<string, unknown>): Result<ChannelInsert> {
  const type = body.type
  // Q6 (2026-09-21): สร้างใหม่ได้เฉพาะอีเมล — telegram/line_group ยังส่งได้ถ้ามีแถวเก่า แต่ไม่รับสร้าง
  if (typeof type !== 'string' || !(CREATABLE_CHANNEL_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: `type ต้องเป็น ${CREATABLE_CHANNEL_TYPES.join(' | ')}` }
  }

  const target = String(body.target_id ?? '').trim().toLowerCase()
  if (!target) return { ok: false, error: 'กรุณาใส่อีเมลผู้รับ' }
  if (type === 'email' && !EMAIL_RE.test(target)) {
    return { ok: false, error: 'อีเมลไม่ถูกรูปแบบ' }
  }
  if (type === 'telegram' && !TELEGRAM_CHAT_RE.test(target)) {
    return { ok: false, error: 'chat id ของ Telegram ต้องเป็นตัวเลข (กลุ่มมักขึ้นต้นด้วย -100)' }
  }
  if (type === 'line_group' && !LINE_GROUP_RE.test(target)) {
    return { ok: false, error: 'groupId ของ LINE ต้องขึ้นต้นด้วย C ตามด้วย hex 32 ตัว' }
  }

  const eventsRes = validateEvents(body.events)
  if (!eventsRes.ok) return eventsRes

  let token: string | null = null
  if (body.token) return { ok: false, error: 'channel อีเมลไม่ใช้ token (API key อยู่ใน env RESEND_API_KEY)' }
  if (type === 'telegram') {
    const raw = String(body.token ?? '').trim()
    if (!TELEGRAM_TOKEN_RE.test(raw)) {
      return { ok: false, error: 'Telegram bot token ไม่ถูกรูปแบบ (ตัวอย่าง 123456789:AAF…)' }
    }
    token = encryptSecret(raw) // throw ถ้าไม่มี NOTIFY_TOKEN_KEY — ไม่เก็บ plaintext เด็ดขาด
  } else if (body.token) {
    return { ok: false, error: 'line_group ไม่ใช้ token (ใช้ LINE_CHANNEL_ACCESS_TOKEN ของ OA)' }
  }

  return {
    ok: true,
    value: { type, target_id: target, events: eventsRes.value, is_active: body.is_active === undefined ? true : Boolean(body.is_active), token },
  }
}

export function validateEvents(raw: unknown): Result<string[]> {
  if (raw === undefined) return { ok: true, value: [...TEAM_EVENTS] }
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'ต้องเลือก event อย่างน้อย 1 อย่าง' }
  const events = Array.from(new Set(raw.map(String)))
  const bad = events.find((e) => !isTeamEvent(e))
  if (bad) return { ok: false, error: `ไม่รู้จัก event "${bad}" (ใช้ได้: ${TEAM_EVENTS.join(', ')})` }
  return { ok: true, value: events }
}

/** ตรวจ body ของ PATCH — แก้ได้: is_active, events, token (telegram เท่านั้น) */
export function validatePatch(
  current: NotificationChannel,
  body: Record<string, unknown>
): Result<Record<string, unknown>> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active)

  if (body.events !== undefined) {
    const r = validateEvents(body.events)
    if (!r.ok) return r
    update.events = r.value
  }

  if (body.token !== undefined) {
    if (current.type !== 'telegram') return { ok: false, error: 'line_group ไม่ใช้ token' }
    const raw = String(body.token ?? '').trim()
    if (!TELEGRAM_TOKEN_RE.test(raw)) return { ok: false, error: 'Telegram bot token ไม่ถูกรูปแบบ' }
    update.token = encryptSecret(raw)
    update.last_error = null
  }

  if (Object.keys(update).length === 1) return { ok: false, error: 'ไม่มีข้อมูลที่จะแก้ไข' }
  return { ok: true, value: update }
}
