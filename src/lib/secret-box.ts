/**
 * secret-box — เข้ารหัส credential ที่ต้องเก็บใน DB (Telegram bot token, MIGRATION_PLAN.md §9.5)
 *
 * AES-256-GCM · คีย์จาก NOTIFY_TOKEN_KEY (64 hex) · รูปแบบที่เก็บ: `enc:v1:<iv>:<tag>:<ciphertext>` (base64)
 *
 * - ไม่มีคีย์ → throw ตอนเรียกใช้ (ไม่ใช่ตอน boot) — instance ที่ไม่ใช้ Telegram ยังรันได้
 *   แต่จะ "บันทึก token" หรือ "ส่ง" โดยไม่มีคีย์ไม่ได้เด็ดขาด ไม่มี fallback เก็บ plaintext
 * - server-only: import serverEnv ซึ่งฝั่ง client throw อยู่แล้ว
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { serverEnv } from '@/config/env'

const PREFIX = 'enc:v1:'

function key(): Buffer {
  const hex = serverEnv.NOTIFY_TOKEN_KEY
  if (!hex) {
    throw new Error('NOTIFY_TOKEN_KEY ไม่ได้ตั้งค่า — ตั้งค่า 64 hex (openssl rand -hex 32) ก่อนใช้ Telegram channel')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) {
    // ค่าที่ไม่ได้เข้ารหัสไม่ควรมีอยู่ในฐาน — ถ้ามีถือว่าผิด ไม่ยอมใช้ต่อ
    throw new Error('token ใน DB ไม่ได้อยู่ในรูปแบบเข้ารหัส (enc:v1) — กรอก token ใหม่ผ่านหน้า /admin/notifications')
  }
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(':')
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('token ใน DB เสียหาย (รูปแบบ enc:v1 ไม่ครบ)')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8')
}

/**
 * ค่าที่ให้ GET คืนไป — ไม่เคยคืน token จริง
 * Telegram token หน้าตา `123456789:AAF...` → โชว์ bot id + 4 ตัวท้าย: `123456789:••••••••abcd`
 */
export function maskSecret(plain: string): string {
  const colon = plain.indexOf(':')
  const tail = plain.slice(-4)
  if (colon > 0 && colon < 20) return `${plain.slice(0, colon)}:••••••••${tail}`
  return `••••••••${tail}`
}
