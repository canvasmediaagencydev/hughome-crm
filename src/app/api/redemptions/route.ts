import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'

export async function GET() {
  // Identity from the session — never a client-supplied userId (Sprint 2.1 B).
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Logged in but no profile yet → no redemptions.
  if (!session.uid) {
    return NextResponse.json([])
  }

  try {
    const supabase = createServerSupabaseClient()
    const { data: redemptions, error } = await supabase
      .from('redemptions')
      .select(`
        *,
        rewards (
          id,
          name,
          description,
          image_url,
          points_cost
        )
      `)
      .eq('user_id', session.uid)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(redemptions)
  } catch (error) {
    console.error('Fetch redemptions error:', error)
    return NextResponse.json({ error: 'Failed to fetch redemptions' }, { status: 500 })
  }
}
