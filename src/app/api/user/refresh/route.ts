import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'
import { isUserOnboarded } from '@/lib/onboarding-utils'
import { todayBangkok } from '@/lib/bangkok-date'

export async function POST(): Promise<NextResponse> {
  // Identity from the session, never from the body.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServerSupabaseClient()
    const query = supabase
      .from('user_profiles')
      .select('id, points_balance, first_name, last_name, picture_url, role, phone')
    const { data: userProfile, error } = session.uid
      ? await query.eq('id', session.uid).maybeSingle()
      : await query.eq('line_user_id', session.line_user_id).maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: 'Lookup failed' }, { status: 500 })
    }
    if (!userProfile) {
      // Logged in but no profile yet (pre-onboarding)
      return NextResponse.json({
        success: true,
        updates: { points_balance: 0, next_expiry: null, first_name: '', last_name: '', picture_url: null, is_onboarded: false },
      })
    }

    // แต้มก้อนที่จะหมดอายุเร็วที่สุด (step-wise expiry, Sprint 7) — รวมทุก lot ที่หมดวันเดียวกัน
    const { data: lots } = await supabase
      .from('point_batch_ledger')
      .select('points_remaining, expires_at')
      .eq('user_id', userProfile.id)
      .gt('points_remaining', 0)
      .gte('expires_at', todayBangkok())
      .order('expires_at', { ascending: true })
    let next_expiry: { points: number; expires_at: string } | null = null
    if (lots && lots.length > 0) {
      const expires_at = lots[0].expires_at
      const points = lots.filter((l) => l.expires_at === expires_at).reduce((s, l) => s + l.points_remaining, 0)
      next_expiry = { points, expires_at }
    }

    return NextResponse.json({
      success: true,
      updates: {
        points_balance: userProfile.points_balance || 0,
        next_expiry,
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        picture_url: userProfile.picture_url || null,
        is_onboarded: isUserOnboarded(userProfile),
      },
    })
  } catch (error) {
    console.error('Refresh API error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}
