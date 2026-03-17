import { NextRequest, NextResponse } from 'next/server'
import { createClientSupabaseClient } from '@/lib/supabase-server'

function toInternationalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('66')) return `+${digits}`
  if (digits.startsWith('0')) return `+66${digits.slice(1)}`
  return `+66${digits}`
}

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json({ success: false, error: 'กรุณาใส่เบอร์โทรศัพท์' }, { status: 400 })
    }

    const internationalPhone = toInternationalPhone(phone)
    const thaiPhoneRegex = /^\+66[689]\d{8}$/
    if (!thaiPhoneRegex.test(internationalPhone)) {
      return NextResponse.json({ success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabase = createClientSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({ phone: internationalPhone })

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
