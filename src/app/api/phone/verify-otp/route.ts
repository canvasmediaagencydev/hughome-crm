import { NextRequest, NextResponse } from 'next/server'
import { getSession, createSession } from '@/lib/session'
import { normalizeThaiPhone } from '@/lib/phone'
import { verifyOtp } from '@/lib/thaibulksms-otp'

// How long a phone stays "verified" in the session before onboarding must
// re-verify. 15 min: comfortable to fill the short onboarding form (name / type
// / birthday) even with interruptions, yet short enough to bound replay if the
// session leaks.
const VERIFIED_PHONE_TTL_SEC = 15 * 60

export async function POST(request: NextRequest) {
  // Must be logged in (LINE) before verifying a phone.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { phone, token } = await request.json()
    if (!phone || !token) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    }

    const local = normalizeThaiPhone(phone)
    if (!local) {
      return NextResponse.json({ success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
    }

    // The PIN must answer the SMS this session asked for, sent to this phone.
    if (!session.otp_token || session.otp_phone !== local) {
      return NextResponse.json({ success: false, error: 'กรุณากดส่ง OTP ใหม่' }, { status: 400 })
    }

    let valid: boolean
    try {
      valid = await verifyOtp(session.otp_token, String(token))
    } catch (error) {
      console.error('Verify OTP error:', error)
      return NextResponse.json({ success: false, error: 'ตรวจสอบ OTP ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 })
    }
    if (!valid) {
      return NextResponse.json({ success: false, error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' }, { status: 400 })
    }

    // Bind the verified phone into the session (canonical 0xxxxxxxxx form) and
    // drop the used token so it cannot be replayed.
    const next = {
      ...session,
      verified_phone: local,
      vp_exp: Math.floor(Date.now() / 1000) + VERIFIED_PHONE_TTL_SEC,
    }
    delete next.otp_token
    delete next.otp_phone
    await createSession(next)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify OTP API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
