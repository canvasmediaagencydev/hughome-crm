import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

interface RefreshRequestBody {
  userId: string
}

interface RefreshResponse {
  success: boolean
  updates?: {
    points_balance: number
    first_name: string
    last_name: string
    picture_url: string | null
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<RefreshResponse>> {
  try {
    const body: RefreshRequestBody = await request.json()
    const { userId } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get fresh user data from Supabase
    const supabase = createServerSupabaseClient()
    
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('points_balance, first_name, last_name, picture_url')
      .eq('id', userId)
      .single()

    if (error || !userProfile) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      updates: {
        points_balance: userProfile.points_balance || 0,
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        picture_url: userProfile.picture_url || null
      }
    })

  } catch (error) {
    console.error('Refresh API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}