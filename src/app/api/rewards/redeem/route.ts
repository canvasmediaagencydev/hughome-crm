import { NextRequest, NextResponse, after } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'
import { TENANT } from '@/config/tenant'
import { getUserDisplayName } from '@/lib/utils/formatters'
import { buildRedemptionCreatedText, notifyTeam } from '@/lib/team-notify'

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

    // All checks (stock, balance) + FIFO deduction + pickup_code happen atomically
    // in the RPC under a row lock — no client-supplied user id, no race conditions.
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

    const [{ data: profile }, { data: redemption }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('points_balance, display_name, first_name, last_name, phone')
        .eq('id', session.uid)
        .maybeSingle(),
      supabase
        .from('redemptions')
        .select('id, pickup_code, points_used, quantity, status, rewards ( name )')
        .eq('id', redemptionId)
        .maybeSingle(),
    ])

    // แจ้งทีมหลังตอบลูกค้าแล้ว (Sprint 8 §6.2 ข้อ 2) — ล้มก็ไม่กระทบใบแลก (จดลง last_error)
    if (redemption && profile) {
      // client ไม่ได้ผูก Database generic → join มาเป็น any (object หรือ array แล้วแต่ inference)
      const rel = redemption.rewards as { name: string } | { name: string }[] | null
      const rewardName = Array.isArray(rel) ? rel[0]?.name : rel?.name
      const text = buildRedemptionCreatedText({
        tenantName: TENANT.name,
        customerName: getUserDisplayName(profile),
        phone: profile.phone,
        rewardName: rewardName ?? '-',
        quantity: redemption.quantity,
        pointsUsed: redemption.points_used,
        pickupCode: redemption.pickup_code,
        adminUrl: `${new URL(request.url).origin}/admin/redemptions`,
      })
      after(() => notifyTeam(supabase, 'redemption.created', text))
    }

    return NextResponse.json({
      success: true,
      redemptionId,
      pickupCode: redemption?.pickup_code ?? null,
      newBalance: profile?.points_balance ?? null,
    })
  } catch (error) {
    console.error('Redemption error:', error)
    return NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 })
  }
}
