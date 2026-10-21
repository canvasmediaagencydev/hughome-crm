/**
 * team-notify — แจ้งทีมร้าน (MIGRATION_PLAN.md §4.2, §9.5 · Sprint 8 → Sprint 10)
 *
 *   email      : Resend API (Sprint 10 · ช่องทางที่ลูกค้าเลือก 2026-09-21) · target = อีเมลผู้รับ
 *                key จาก env RESEND_API_KEY + ผู้ส่ง NOTIFY_EMAIL_FROM · ไม่มี token ต่อ channel
 *   telegram   : Bot API sendMessage · token (เข้ารหัสใน DB) + chat id ของกลุ่ม — ถอดจาก UI แล้ว (Q6)
 *                code path เก็บไว้ให้แถวเก่าส่งต่อได้ ไม่สร้างใหม่
 *   line_group : Messaging API push ด้วย LINE_CHANNEL_ACCESS_TOKEN ของ OA · target = groupId — ถอดจาก UI แล้ว
 *
 * กติกา:
 *   - notify ล้มต้องไม่ทำให้การแลกของล้มตาม → เก็บลง notification_channels.last_error แล้วจบ
 *   - token ห้าม log · ห้ามคืนออก API (route ใช้ maskSecret)
 *   - timeout 5 วิ ต่อ channel (self-check: ข้อความต้องถึงใน 5 วิ)
 */
import { pushMessage } from '@/lib/line-messaging'
import { decryptSecret } from '@/lib/secret-box'
import { serverEnv } from '@/config/env'
import { formatThaiPhone } from '@/lib/phone'
import { PERMISSIONS } from '@/types/admin'
import type { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Tables } from '../../database.types'

type Supabase = ReturnType<typeof createServerSupabaseClient>
export type NotificationChannel = Tables<'notification_channels'>

export const CHANNEL_TYPES = ['email', 'telegram', 'line_group'] as const
export type ChannelType = (typeof CHANNEL_TYPES)[number]
/** ประเภทที่สร้างใหม่ได้จาก UI/API (Q6: อีเมลเท่านั้น · telegram/line_group เหลือแค่แถวเก่า) */
export const CREATABLE_CHANNEL_TYPES = ['email'] as const

export const TEAM_EVENTS = ['redemption.created', 'batch.submitted', 'issue.reported'] as const
export type TeamEvent = (typeof TEAM_EVENTS)[number]

/**
 * คนที่ต้องกดอนุมัติ/จัดการเรื่องนั้น — ได้อีเมลอัตโนมัติจาก "รายการผู้ดูแลระบบ" (admin_users)
 * โดยไม่ต้องเพิ่ม channel เอง (เจ้าของระบบขอ 2026-10-19) · ใช้สิทธิ์ ไม่ใช่ชื่อ role
 * เพื่อให้ตรงกับคนที่เห็นปุ่มจริง
 */
const APPROVER_PERMISSION: Record<TeamEvent, string> = {
  'batch.submitted': PERMISSIONS.BATCHES_APPROVE,
  'redemption.created': PERMISSIONS.REDEMPTIONS_PROCESS,
  'issue.reported': PERMISSIONS.ISSUES_MANAGE,
}

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

/** บรรทัดแรกของข้อความ = หัวข้ออีเมล (ตัดอีโมจิ/วงเล็บสาขาออก) */
function subjectFromText(text: string): string {
  const first = text.split('\n')[0] ?? ''
  return first.replace(/^[^\p{L}\p{N}\[]+/u, '').trim().slice(0, 120) || 'Hug Point'
}

async function sendEmail(to: string, text: string): Promise<void> {
  const apiKey = serverEnv.RESEND_API_KEY
  const from = serverEnv.NOTIFY_EMAIL_FROM
  if (!apiKey) throw new Error('RESEND_API_KEY ไม่ได้ตั้งค่า — ตั้งใน env ก่อนใช้ channel อีเมล')
  if (!from) throw new Error('NOTIFY_EMAIL_FROM ไม่ได้ตั้งค่า — เช่น "Hug Point <onboarding@resend.dev>"')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: subjectFromText(text), text }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) {
    // body ของ Resend ไม่มี API key — เอา message มาได้
    const body = (await res.json().catch(() => null)) as { message?: string; name?: string } | null
    throw new Error(`Resend ${res.status}: ${body?.message ?? body?.name ?? 'send failed'}`)
  }
}

export async function sendToChannel(channel: NotificationChannel, text: string): Promise<void> {
  if (channel.type === 'email') {
    await sendEmail(channel.target_id, text)
    return
  }
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
    `เบอร์: ${formatThaiPhone(p.phone) || '-'}`,
    `ของรางวัล: ${p.rewardName}${p.quantity > 1 ? ` ×${p.quantity}` : ''}`,
    `ใช้แต้ม: ${p.pointsUsed.toLocaleString('th-TH')} แต้ม`,
  ]
  if (p.pickupCode) lines.push(`รหัสรับของ: ${p.pickupCode}`)
  lines.push(`จัดการ: ${p.adminUrl}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Event: issue.reported — admin กดแจ้งปัญหาการใช้งาน (migration 028)
// ---------------------------------------------------------------------------
export interface IssueReportedPayload {
  tenantName: string
  reporterName: string
  categoryLabel: string
  title: string
  description: string
  pageUrl: string | null
  /** absolute URL ของหน้า /admin/issues */
  adminUrl: string
}

export function buildIssueReportedText(p: IssueReportedPayload): string {
  // ตัดรายละเอียดให้สั้นพออ่านในอีเมล/แชท — ฉบับเต็มอยู่ที่ /admin/issues
  const desc = p.description.length > 600 ? p.description.slice(0, 600) + '…' : p.description
  const lines = [
    `🐞 [${p.tenantName}] มีการแจ้งปัญหาการใช้งาน`,
    `แจ้งโดย: ${p.reporterName}`,
    `ประเภท: ${p.categoryLabel}`,
    `หัวข้อ: ${p.title}`,
  ]
  if (p.pageUrl) lines.push(`หน้าที่แจ้ง: ${p.pageUrl}`)
  lines.push('', desc, '', `ดู/อัปเดตสถานะ: ${p.adminUrl}`)
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Event: batch.submitted — บัญชีส่งชุดยอดขายให้ผู้อนุมัติ (Sprint 9R A2)
// ---------------------------------------------------------------------------
export interface BatchSubmittedPayload {
  tenantName: string
  submitterName: string
  fileName: string
  weekStart: string
  weekEnd: string
  awardableRows: number
  totalRows: number
  totalPoints: number
  /** absolute URL ของหน้า /admin/batches */
  adminUrl: string
}

export function buildBatchSubmittedText(p: BatchSubmittedPayload): string {
  return [
    `📋 [${p.tenantName}] มีชุดยอดขายรอผู้อนุมัติ`,
    `ส่งโดย: ${p.submitterName}`,
    `สัปดาห์: ${p.weekStart} → ${p.weekEnd}`,
    `ไฟล์: ${p.fileName}`,
    `แถวที่จะได้แต้ม: ${p.awardableRows} จาก ${p.totalRows}`,
    `แต้มรวม: ${p.totalPoints.toLocaleString('th-TH')} แต้ม`,
    `อนุมัติ/ปฏิเสธ: ${p.adminUrl}`,
  ].join('\n')
}

/** อีเมลของผู้ดูแลระบบที่ active และถือสิทธิ์นี้ (ผ่าน role) · lowercase ไม่ซ้ำ */
export async function loadApproverEmails(supabase: Supabase, permissionKey: string): Promise<string[]> {
  const { data: perm, error: permErr } = await supabase
    .from('admin_permissions')
    .select('admin_role_permissions(role_id)')
    .eq('permission_key', permissionKey)
    .maybeSingle()
  if (permErr) throw new Error(`load permission ${permissionKey}: ${permErr.message}`)
  const roleIds = ((perm?.admin_role_permissions ?? []) as { role_id: string }[]).map((r) => r.role_id)
  if (roleIds.length === 0) return []

  const { data: links, error: linkErr } = await supabase
    .from('admin_user_roles')
    .select('admin_users!admin_user_roles_admin_user_id_fkey(email, is_active)')
    .in('role_id', roleIds)
  if (linkErr) throw new Error(`load admin users: ${linkErr.message}`)

  const emails = new Set<string>()
  for (const link of links ?? []) {
    // join มาเป็น object หรือ array แล้วแต่ inference
    const rel = link.admin_users as { email: string; is_active: boolean } | { email: string; is_active: boolean }[] | null
    for (const u of Array.isArray(rel) ? rel : rel ? [rel] : []) {
      if (u.is_active && u.email) emails.add(u.email.trim().toLowerCase())
    }
  }
  return [...emails]
}

/**
 * ยิงเข้าทุก channel ที่ active และสมัคร event นี้ + อีเมลผู้ดูแลระบบที่ต้องอนุมัติเรื่องนี้
 * (ไม่ส่งซ้ำถ้าอีเมลนั้นมี channel อยู่แล้ว) — ไม่ throw ไม่ว่ากรณีใด
 * (เรียกจาก after() หลังตอบ request ไปแล้ว)
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
    }
    const channels = data ?? []
    const channelEmails = new Set(
      channels.filter((ch) => ch.type === 'email').map((ch) => ch.target_id.trim().toLowerCase())
    )

    let approverEmails: string[] = []
    try {
      approverEmails = (await loadApproverEmails(supabase, APPROVER_PERMISSION[event])).filter(
        (e) => !channelEmails.has(e)
      )
    } catch (err) {
      console.error('[team-notify] load approvers failed:', err instanceof Error ? err.message : err)
    }

    await Promise.all([
      ...channels.map((ch) => deliverAndRecord(supabase, ch, text)),
      ...approverEmails.map((to) =>
        sendEmail(to, text).catch((err) => {
          // ไม่มีแถว channel ให้จด last_error — log อย่างเดียว
          console.error(`[team-notify] approver email ${event} failed:`, err instanceof Error ? err.message : err)
        })
      ),
    ])
  } catch (err) {
    console.error('[team-notify] unexpected:', err instanceof Error ? err.message : err)
  }
}
