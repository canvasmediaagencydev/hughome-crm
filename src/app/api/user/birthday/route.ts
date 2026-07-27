import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSession } from '@/lib/session'

interface UpdateBirthdayBody {
  birthday: string
}

export async function POST(request: NextRequest) {
  // Identity from the session, never from the body.
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { birthday }: UpdateBirthdayBody = await request.json()
    if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      return NextResponse.json({ error: 'Invalid birthday format (expected YYYY-MM-DD)' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ birthday, updated_at: new Date().toISOString() })
      .eq('line_user_id', session.line_user_id)
      .select('id, birthday')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update birthday' }, { status: 500 })
    }

    return NextResponse.json({ success: true, birthday: data.birthday })
  } catch (err) {
    console.error('Update birthday error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
