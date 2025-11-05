import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isUserOnboarded } from '@/lib/onboarding-utils'

interface OnboardingRequestBody {
  line_user_id: string
  role: 'homeowner' | 'contractor'
  first_name: string
  last_name: string
  phone: string
}

export async function POST(request: NextRequest) {
  try {
    const body: OnboardingRequestBody = await request.json()
    const { line_user_id, role, first_name, last_name, phone } = body

    if (!line_user_id || !role || !first_name || !last_name || !phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    
    // Update user profile with onboarding data
    const { data: updatedUser, error } = await supabase
      .from('user_profiles')
      .update({
        role,
        first_name,
        last_name,
        phone,
        updated_at: new Date().toISOString()
      })
      .eq('line_user_id', line_user_id)
      .select()
      .single()

    if (error) {
      console.error('Onboarding update error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    if (!updatedUser) {
      console.error('Onboarding update returned null')
      return NextResponse.json(
        { success: false, error: 'Failed to update profile - no data returned' },
        { status: 500 }
      )
    }

    // Calculate is_onboarded using shared utility
    const onboardedStatus = isUserOnboarded(updatedUser)

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        line_user_id: updatedUser.line_user_id,
        display_name: updatedUser.display_name,
        picture_url: updatedUser.picture_url,
        role: updatedUser.role,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        phone: updatedUser.phone,
        points_balance: updatedUser.points_balance || 0,
        is_onboarded: onboardedStatus
      }
    })

  } catch (error) {
    console.error('Onboarding API error:', error)
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