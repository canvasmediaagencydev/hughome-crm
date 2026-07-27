import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSession, createSession } from '@/lib/session'
import { isUserOnboarded } from '@/lib/onboarding-utils'
import { normalizeThaiPhone } from '@/lib/phone'

interface OnboardingRequestBody {
  role: 'homeowner' | 'contractor'
  first_name: string
  last_name: string
  phone: string
  birthday: string // required (schema: user_profiles.birthday NOT NULL)
}

export async function POST(request: NextRequest) {
  // Identity from the session, never from the body.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: OnboardingRequestBody = await request.json()
    const { role, first_name, last_name, phone, birthday } = body

    if (!role || !first_name || !last_name || !phone || !birthday) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (role, first_name, last_name, phone, birthday)' },
        { status: 400 },
      )
    }
    if (role !== 'homeowner' && role !== 'contractor') {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return NextResponse.json({ success: false, error: 'Invalid birthday format (YYYY-MM-DD)' }, { status: 400 })
    }

    // The phone MUST be the one this session verified via OTP, and still valid.
    // Phone is the key of the whole points system, so registering someone else's
    // number without passing its OTP is not allowed (Sprint 2.1 A).
    const localPhone = normalizeThaiPhone(phone)
    if (!localPhone) {
      return NextResponse.json({ success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' }, { status: 400 })
    }
    const nowSec = Math.floor(Date.now() / 1000)
    if (
      !session.verified_phone ||
      !session.vp_exp ||
      session.vp_exp < nowSec ||
      session.verified_phone !== localPhone
    ) {
      return NextResponse.json(
        { success: false, error: 'กรุณายืนยันเบอร์โทรศัพท์ด้วย OTP ก่อน (หรือยืนยันใหม่)' },
        { status: 403 },
      )
    }

    const supabase = createServerSupabaseClient()

    // Create the profile now (birthday is required from day one). Idempotent on
    // line_user_id: onboarding again updates the existing row.
    const { data: user, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          line_user_id: session.line_user_id,
          display_name: session.name ?? null,
          picture_url: session.picture ?? null,
          role,
          first_name,
          last_name,
          phone: localPhone, // canonical 0xxxxxxxxx (matches batch upload)
          birthday,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'line_user_id' },
      )
      .select()
      .single()

    if (error) {
      // Unique violation on phone → friendly message
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ success: false, error: 'เบอร์โทรนี้ถูกใช้งานแล้ว' }, { status: 409 })
      }
      console.error('Onboarding upsert error:', error)
      return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 })
    }

    // Now that the profile exists, bind uid into the session.
    await createSession({
      line_user_id: session.line_user_id,
      name: session.name,
      picture: session.picture,
      uid: user.id,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        line_user_id: user.line_user_id,
        display_name: user.display_name,
        picture_url: user.picture_url,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone,
        points_balance: user.points_balance || 0,
        is_onboarded: isUserOnboarded(user),
      },
    })
  } catch (error) {
    console.error('Onboarding API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}
