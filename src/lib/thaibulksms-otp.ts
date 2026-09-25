/**
 * ThaiBulkSMS OTP Manager (Sprint 10 — replaces Supabase Auth phone OTP).
 *
 * ThaiBulkSMS generates the PIN, sends the SMS, and checks the PIN. We only keep
 * the opaque `token` it returns, bound to the phone inside the signed session
 * cookie (src/lib/session.ts), so the client never sees it and cannot swap it.
 *
 * App settings (sender, brand, PIN length, expiry) live in the ThaiBulkSMS
 * dashboard → SMS → จัดการ SMS OTP, not in code.
 * Docs: https://developer.thaibulksms.com/reference/post_v2-otp-request
 */
import { serverEnv } from '@/config/env'

const BASE_URL = 'https://otp.thaibulksms.com/v2/otp'

function credentials() {
  // Both are required by serverSchema, so this only guards against a future
  // schema change — never fall back to an empty string.
  const key = serverEnv.THAIBULKSMS_OTP_KEY
  const secret = serverEnv.THAIBULKSMS_OTP_SECRET
  if (!key || !secret) throw new Error('[otp] THAIBULKSMS_OTP_KEY / THAIBULKSMS_OTP_SECRET is not set')
  return { key, secret }
}

async function post(path: 'request' | 'verify', fields: Record<string, string>) {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ ...credentials(), ...fields }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
  return { ok: res.ok, status: res.status, body }
}

/**
 * Send a PIN to `msisdn` (local 0xxxxxxxxx form).
 * Returns the token to verify against, or throws with the provider's answer.
 */
export async function requestOtp(msisdn: string): Promise<{ token: string; refno: string | null }> {
  const { ok, status, body } = await post('request', { msisdn })
  const token = typeof body?.token === 'string' ? body.token : null
  if (!ok || !token) {
    throw new Error(`[otp] request failed (HTTP ${status}): ${JSON.stringify(body)}`)
  }
  return { token, refno: typeof body?.refno === 'string' ? body.refno : null }
}

/**
 * Check `pin` against a token from requestOtp.
 * `false` = wrong/expired PIN (a user error). Throws only on a provider/transport failure.
 */
export async function verifyOtp(token: string, pin: string): Promise<boolean> {
  const { ok, status, body } = await post('verify', { token, pin })
  if (ok) return body?.status === 'success'
  // 4xx = the provider rejected the PIN/token (wrong, expired, used, too many tries).
  if (status >= 400 && status < 500) {
    console.warn('[otp] verify rejected:', status, JSON.stringify(body))
    return false
  }
  throw new Error(`[otp] verify failed (HTTP ${status}): ${JSON.stringify(body)}`)
}
