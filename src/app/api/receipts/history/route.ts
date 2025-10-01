import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { userId, page = 1, limit = 4 } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    // Get total count
    const { count, error: countError } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (countError) {
      console.error('Error counting receipts:', countError)
      return NextResponse.json(
        { error: 'Failed to count receipts' },
        { status: 500 }
      )
    }

    // Fetch user's receipt history with pagination
    const { data: receipts, error } = await supabase
      .from('receipts')
      .select('id, created_at, total_amount, points_awarded, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      console.error('Error fetching receipt history:', error)
      return NextResponse.json(
        { error: 'Failed to fetch receipt history' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      receipts: receipts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Receipt history error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch history',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    )
  }
}
