/**
 * team-notify — แจ้งทีมร้านเข้า Telegram / LINE group (MIGRATION_PLAN.md §4.2, §9.5 · Sprint 8)
 *
 * LINE Notify ปิดบริการ 31 มี.ค. 2025 → ใช้ 2 ช่องทางนี้แทน
 *   telegram   : Bot API sendMessage · token (เข้ารหัสใน DB) + chat id ของกลุ่ม
 *   line_group : Messaging API push ด้วย LINE_CHANNEL_ACCESS_TOKEN ของ OA · target = groupId
 *                (bot ต้องอยู่ในกลุ่ม) · ไม่ใช้ token ต่อ channel
 *
 * กติกา:
 *   - notify ล้มต้องไม่ทำให้การแลกของล้มตาม → เก็บลง notification_channels.last_error แล้วจบ
 *   - token ห้าม log · ห้ามคืนออก API (route ใช้ maskSecret)
 *   - timeout 5 วิ ต่อ channel (self-check: ข้อความต้องถึงใน 5 วิ)
 */
import { pushMessage } from '@/lib/line-messaging'
import { decryptSecret } from '@/lib/secret-box'
import type { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Tables } from '../../database.types'

type Supabase = ReturnType<typeof createServerSupabaseClient>
export type NotificationChannel = Tables<'notification_channels'>

export const CHANNEL_TYPES = ['telegram', 'line_group'] as const
export type ChannelType = (typeof CHANNEL_TYPES)[number]

export const TEAM_EVENTS = ['redemption.created'] as const
export type TeamEvent = (typeof TEAM_EVENTS)[number]

const TIMEOUT_MS = 5_000

export function isChannelType(v: unknown): v is ChannelType {
  return typeof v === 'string' && (CHANNEL_TYPES as readonly string[]).includes(v)
}
export function isTeamEvent(v: unknown): v is TeamEvent {
  return typeof v === 'string' && (TEAM_EVENTS as readonly string[]).includes(v)
}

// ---------------------------------------------------------------------------
// ส่งข้อความเข้า channel เดียว — throw เมื่อส่งไม่สำเร็จ (คนเรียกเป็นคนตัดสินใจว่าจะกลืนไหม)
// ---------------------------------------------------------------------------
async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    // body ของ Telegram ไม่มี token (token อยู่ใน URL เท่านั้น) — เอา description มาได้
    const body = (await res.json().catch(() => null)) as { description?: string } | null
    throw new Error(`Telegram ${res.status}: ${body?.description ?? 'sendMessage failed'}`)
  }
}

async function sendLineGroup(groupId: string, text: string): Promise<void> {
  await pushMessage(groupId, [{ type: 'text', text }])
}

export async function sendToChannel(channel: NotificationChannel, text: string): Promise<void> {
  if (channel.type === 'telegram') {
    if (!channel.token) throw new Error('Telegram channel ไม่มี token')
    await sendTelegram(decryptSecret(channel.token), channel.target_id, text)
    return
  }
  if (channel.type === 'line_group') {
    await sendLineGroup(channel.target_id, text)
    return
  }
  throw new Error(`unknown channel type: ${channel.type}`)
}

/** ส่ง + จดผลลง DB · คืน error message (ไม่ throw) */
export async function deliverAndRecord(
  supabase: Supabase,
  channel: NotificationChannel,
  text: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await sendToChannel(channel, text)
    await supabase
      .from('notification_channels')
      .update({ last_error: null, last_sent_at: new Date().toISOString() })
      .eq('id', channel.id)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // ไม่มี token ใน message: Telegram error มาจาก description, LINE มาจาก body ของ LINE
    console.error(`[team-notify] ${channel.type} ${channel.id} failed:`, message)
    await supabase.from('notification_channels').update({ last_error: message.slice(0, 500) }).eq('id', channel.id)
    return { ok: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Event: redemption.created — กดแลกสำเร็จ (§6.2 ข้อ 2)
// รูปแบบ: ชื่อลูกค้า + เบอร์ + ของรางวัล + แต้มที่ใช้ + ลิงก์เข้าหน้าจัดการ
// ---------------------------------------------------------------------------
export interface RedemptionCreatedPayload {
  tenantName: string
  customerName: string
  phone: string | null
  rewardName: string
  quantity: number
  pointsUsed: number
  pickupCode: string | null
  /** absolute URL ของหน้า /admin/redemptions (origin มาจาก request) */
  adminUrl: string
}

export function buildRedemptionCreatedText(p: RedemptionCreatedPayload): string {
  const lines = [
    `🎁 [${p.tenantName}] มีคำขอแลกรางวัลใหม่`,
    `ลูกค้า: ${p.customerName}`,
    `เบอร์: ${p.phone ?? '-'}`,
    `ของรางวัล: ${p.rewardName}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`,
    `ใช้แต้ม: ${p.pointsUsed.toLocaleString('th-TH')} แต้ม`,
  ]
  if (p.pickupCode) lines.push(`รหัสรับของ: ${p.pickupCode}`)
  lines.push(`จัดการ: ${p.adminUrl}`)
  return lines.join('\n')
}

/**
 * ยิงเข้าทุก channel ที่ active และสมัคร event นี้ — ไม่ throw ไม่ว่ากรณีใด
 * (เรียกจาก after() ใน POST /api/rewards/redeem หลังตอบลูกค้าไปแล้ว)
 */
export async function notifyTeam(supabase: Supabase, event: TeamEvent, text: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('is_active', true)
      .contains('events', [event])
    if (error) {
      console.error('[team-notify] load channels failed:', error.message)
      return
    }
    await Promise.all((data ?? []).map((ch) => deliverAndRecord(supabase, ch, text)))
  } catch (err) {
    console.error('[team-notify] unexpected:', err instanceof Error ? err.message : err)
  }
}
