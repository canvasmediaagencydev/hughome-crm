import { NextRequest, NextResponse } from 'next/server'
import { createClientSupabaseClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'
import { normalizeThaiPhone, toE164Thai } from '@/lib/phone'
import { rateLimit } from '@/lib/rate-limit'

// Rate limits (Sprint 2.1 C). A legit user needs ~1 send, maybe 1–2 resends if
// the SMS is slow, so:
//   - 60s cooldown between sends to the same number (matches typical OTP UX)
//   - max 3 per number / 10 min   → caps SMS cost per phone
//   - max 5 per session / 10 min  → caps a compromised/abusive session
const WINDOW_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000
const MAX_PER_PHONE = 3
const MAX_PER_SESSION = 5

export async function POST(request: NextRequest) {
  // Must be logged in (LINE) before requesting an OTP — prevents SMS abuse.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { phone } = await request.json()
    const local = normalizeThaiPhone(phone)
    const e164 = toE164Thai(phone)
    if (!local || !e164) {
      return NextResponse.json({ success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
    }

    // Rate limit: cooldown → per-phone → per-session. Checked in order and
    // short-circuited, so a request blocked by an earlier limit does not consume
    // the quota of later ones.
    const tooMany = (retryAfterSec: number) =>
      NextResponse.json(
        { success: false, error: `ขอ OTP บ่อยเกินไป กรุณารอ ${retryAfterSec} วินาที` },
        { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
      )

    const cd = rateLimit(`otp:cd:${local}`, 1, COOLDOWN_MS)
    if (!cd.ok) return tooMany(cd.retryAfterSec)
    const perPhone = rateLimit(`otp:phone:${local}`, MAX_PER_PHONE, WINDOW_MS)
    if (!perPhone.ok) return tooMany(perPhone.retryAfterSec)
    const perSession = rateLimit(`otp:sess:${session.line_user_id}`, MAX_PER_SESSION, WINDOW_MS)
    if (!perSession.ok) return tooMany(perSession.retryAfterSec)

    const supabase = createClientSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 })
    if (error) {
      console.error('Send OTP error:', error)
      return NextResponse.json({ success: false, error: 'ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send OTP API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
