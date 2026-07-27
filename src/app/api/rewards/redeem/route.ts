import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  // Identity from the session, never from the body.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!session.uid) {
    return NextResponse.json({ error: 'กรุณาลงทะเบียนให้เสร็จก่อนแลกรางวัล' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { rewardId, quantity = 1 } = body
    if (!rewardId) {
      return NextResponse.json({ error: 'Reward ID is required' }, { status: 400 })
    }
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // All checks (stock, balance) + FIFO deduction happen atomically in the RPC
    // under a row lock — no client-supplied user id, no race conditions.
    const { data: redemptionId, error } = await supabase.rpc('redeem_reward', {
      p_user: session.uid,
      p_reward: rewardId,
      p_qty: qty,
    })

    if (error) {
      // RPC RAISEs on insufficient points / out of stock / unavailable reward.
      console.warn('redeem_reward failed:', error.message)
      return NextResponse.json({ error: error.message || 'ไม่สามารถแลกรางวัลได้' }, { status: 400 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('points_balance')
      .eq('id', session.uid)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      redemptionId,
      newBalance: profile?.points_balance ?? null,
    })
  } catch (error) {
    console.error('Redemption error:', error)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}
