/**
 * ThaiBulkSMS — ส่ง SMS ข้อความทั่วไป (เตือนแต้มใกล้หมดอายุ · ประชุมลูกค้า 2026-10-21)
 *
 * คนละแอปกับ OTP Manager (src/lib/thaibulksms-otp.ts): ใช้ API key/secret ของ "SMS API"
 * (dashboard → API → API Key) และต้องมี sender name ที่อนุมัติแล้วในบัญชี
 * Docs: https://developer.thaibulksms.com/reference/post_sms
 *
 * env ทั้ง 3 ตัว optional ตอน boot (instance ที่ยังไม่เปิด SMS ต้องรันได้) แต่ตอน "ส่ง" ถ้าขาดตัวใด
 * throw ทันที — ไม่มี sender เริ่มต้น ไม่มี fallback
 */
import { serverEnv } from '@/config/env'

const SMS_URL = 'https://api-v2.thaibulksms.com/sms'

function config() {
  const key = serverEnv.THAIBULKSMS_SMS_KEY
  const secret = serverEnv.THAIBULKSMS_SMS_SECRET
  const sender = serverEnv.THAIBULKSMS_SMS_SENDER
  if (!key || !secret || !sender) {
    throw new Error('[sms] THAIBULKSMS_SMS_KEY / THAIBULKSMS_SMS_SECRET / THAIBULKSMS_SMS_SENDER is not set')
  }
  return { key, secret, sender }
}

/** เรียกก่อนเริ่มส่งทั้งรอบ — ให้ cron ล้มทันทีถ้ายังไม่ตั้งค่า แทนที่จะล้มทีละคน */
export function assertSmsConfigured(): void {
  config()
}

/**
 * ส่ง 1 ข้อความถึง `msisdn` (local 0xxxxxxxxx)
 * true = ผู้ให้บริการรับแล้ว · false = เบอร์ถูกปฏิเสธ/ส่งไม่สำเร็จ (log ไว้ รอบหน้าลองใหม่)
 * throw เฉพาะตอนยังไม่ตั้งค่า
 */
export async function sendSms(msisdn: string, message: string): Promise<boolean> {
  const { key, secret, sender } = config()
  try {
    const res = await fetch(SMS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ msisdn, message, sender, force: 'standard' }),
      cache: 'no-store',
    })
    const body = (await res.json().catch(() => null)) as { bad_phone_number_list?: unknown[] } | null
    const bad = Array.isArray(body?.bad_phone_number_list) && body.bad_phone_number_list.length > 0
    if (!res.ok || bad) {
      console.error(`[sms] send failed (HTTP ${res.status}):`, JSON.stringify(body))
      return false
    }
    return true
  } catch (e) {
    console.error('[sms] transport error:', e instanceof Error ? e.message : e)
    return false
  }
}
