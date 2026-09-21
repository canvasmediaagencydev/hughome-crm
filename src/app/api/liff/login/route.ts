import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyLineIdToken, extractUserProfileData } from '@/lib/line-auth'
import { createSession } from '@/lib/session'
import { isUserOnboarded } from '@/lib/onboarding-utils'

interface LoginRequestBody {
  idToken: string
  skipDbUpdate?: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Auth: verify the LINE ID token (signature + iss + aud + exp) ---------
  let profileData: ReturnType<typeof extractUserProfileData>
  try {
    const body: LoginRequestBody = await request.json()
    if (!body?.idToken || typeof body.idToken !== 'string') {
      return NextResponse.json({ success: false, error: 'ID token is required' }, { status: 400 })
    }
    const tokenPayload = await verifyLineIdToken(body.idToken)
    profileData = extractUserProfileData(tokenPayload)
  } catch (err) {
    // Any verification failure → 401 (never trust the token)
    console.warn('LINE token verification failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ success: false, error: 'Invalid LINE token' }, { status: 401 })
  }

  // --- Identity established. Look up (do NOT create) the profile. -----------
  try {
    const supabase = createServerSupabaseClient()
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('line_user_id', profileData.line_user_id)
      .maybeSingle()

    // Refresh display fields for known users (best-effort).
    if (existingUser) {
      const lastLogin = existingUser.last_login_at ? new Date(existingUser.last_login_at) : new Date(0)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      await supabase
        .from('user_profiles')
        .update({
          display_name: profileData.display_name,
          picture_url: profileData.picture_url,
          ...(lastLogin < hourAgo ? { last_login_at: new Date().toISOString() } : {}),
        })
        .eq('line_user_id', profileData.line_user_id)
    }

    // Issue the server session — identity comes from the verified token, not the client.
    await createSession({
      line_user_id: profileData.line_user_id,
      name: profileData.display_name,
      picture: profileData.picture_url,
      uid: existingUser?.id,
    })

    const onboarded = existingUser ? isUserOnboarded(existingUser) : false
    return NextResponse.json({
      success: true,
      user: {
        id: existingUser?.id ?? null,
        line_user_id: profileData.line_user_id,
        display_name: existingUser?.display_name ?? profileData.display_name,
        picture_url: existingUser?.picture_url ?? profileData.picture_url,
        role: existingUser?.role ?? null,
        first_name: existingUser?.first_name ?? null,
        last_name: existingUser?.last_name ?? null,
        phone: existingUser?.phone ?? null,
        is_onboarded: onboarded,
        points_balance: existingUser?.points_balance ?? 0,
        // Sprint 9R A1: ลูกค้าเห็นรหัสตัวเอง + วันที่สมัคร (null = ยังไม่กำหนดรหัส · ไม่ generate เอง — Q1)
        customer_code: existingUser?.customer_code ?? null,
        created_at: existingUser?.created_at ?? null,
      },
    })
  } catch (error) {
    console.error('Login API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}
