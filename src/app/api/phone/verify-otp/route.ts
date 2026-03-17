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
    const { phone, token } = await request.json()

    if (!phone || !token) {
      return NextResponse.json({ success: false, error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    }

    const internationalPhone = toInternationalPhone(phone)
    const supabase = createClientSupabaseClient()

    const { error } = await supabase.auth.verifyOtp({
      phone: internationalPhone,
      token,
      type: 'sms',
    })

    if (error) {
      console.error('Verify OTP error:', error)
      return NextResponse.json({ success: false, error: 'รหัส OTP ไม่ถูกต้องหรือหมดอายุ' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify OTP API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
