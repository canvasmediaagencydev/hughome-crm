import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyLineIdToken, extractUserProfileData } from '@/lib/line-auth'
import { isUserOnboarded } from '@/lib/onboarding-utils'

interface LoginRequestBody {
  idToken: string
  skipDbUpdate?: boolean
}

interface LoginResponse {
  success: boolean
  user?: {
    id: string
    line_user_id: string
    display_name: string | null
    picture_url: string | null
    role: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    is_onboarded: boolean
    points_balance: number
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    const body: LoginRequestBody = await request.json()
    const { idToken, skipDbUpdate = false } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Verify LINE token
    const tokenPayload = await verifyLineIdToken(idToken)
    const profileData = extractUserProfileData(tokenPayload)

    // Create or get user from Supabase
    const supabase = createServerSupabaseClient()
    
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('line_user_id', profileData.line_user_id)
      .single()

    let userProfile
    if (existingUser) {
      if (skipDbUpdate) {
        // Skip database update for cached validation - just return existing user
        userProfile = existingUser
      } else {
        // Update existing user with fresh data
        const updateData: any = {
          display_name: profileData.display_name,
          picture_url: profileData.picture_url,
        }
        
        // Only update last_login_at if it's been more than 1 hour
        const lastLogin = existingUser.last_login_at ? new Date(existingUser.last_login_at) : new Date(0)
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
        
        if (lastLogin < hourAgo) {
          updateData.last_login_at = new Date().toISOString()
        }
        
        const { data: updatedUser } = await supabase
          .from('user_profiles')
          .update(updateData)
          .eq('line_user_id', profileData.line_user_id)
          .select()
          .single()
        
        userProfile = updatedUser || existingUser
      }
    } else {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: uuidv4(),
          line_user_id: profileData.line_user_id,
          display_name: profileData.display_name,
          picture_url: profileData.picture_url,
          last_login_at: new Date().toISOString(),
          role: null,
          first_name: null,
          last_name: null,
          phone: null,
          points_balance: 0
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create user profile:', insertError)
        throw new Error(`Database insert failed: ${insertError.message}`)
      }

      if (!newUser) {
        console.error('User profile creation returned null')
        throw new Error('Database insert returned no data')
      }

      userProfile = newUser
    }

    if (!userProfile) {
      console.error('User profile is null after database operations')
      throw new Error('Failed to create or update user profile')
    }

    // Check if user is onboarded using shared utility
    const onboardedStatus = isUserOnboarded(userProfile)

    return NextResponse.json({
      success: true,
      user: {
        id: userProfile.id,
        line_user_id: userProfile.line_user_id,
        display_name: userProfile.display_name,
        picture_url: userProfile.picture_url,
        role: userProfile.role,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        phone: userProfile.phone,
        is_onboarded: onboardedStatus,
        points_balance: userProfile.points_balance || 0
      }
    })

  } catch (error) {
    console.error('Login API error:', error)
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