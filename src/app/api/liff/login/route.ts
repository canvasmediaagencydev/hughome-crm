import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { createServerSupabaseClient, type UserProfileInsert } from '@/lib/supabase-server'
import { verifyLineIdToken, extractUserProfileData, validateLineConfig } from '@/lib/line-auth'

interface LoginRequestBody {
  idToken: string
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
  }
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<LoginResponse>> {
  try {
    // Parse request body
    let body: LoginRequestBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { idToken } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Validate LINE configuration
    const { liffId } = validateLineConfig()

    // Verify the LINE ID token
    let tokenPayload
    try {
      tokenPayload = await verifyLineIdToken(idToken, liffId)
    } catch (error) {
      console.error('LINE token verification error:', error)
      return NextResponse.json(
        { success: false, error: 'Invalid or expired LINE token' },
        { status: 401 }
      )
    }

    // Extract user profile data from token
    const profileData = extractUserProfileData(tokenPayload)

    // Initialize Supabase client with service role for admin operations
    const supabase = createServerSupabaseClient()

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('line_user_id', profileData.line_user_id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found", which is expected for new users
      console.error('Database fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Database error occurred' },
        { status: 500 }
      )
    }

    let userProfile

    if (existingUser) {
      // Update existing user with latest LINE profile data
      const { data: updatedUser, error: updateError } = await supabase
        .from('user_profiles')
        .update({
          display_name: profileData.display_name,
          picture_url: profileData.picture_url,
          updated_at: new Date().toISOString(),
        })
        .eq('line_user_id', profileData.line_user_id)
        .select()
        .single()

      if (updateError) {
        console.error('User profile update error:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update user profile' },
          { status: 500 }
        )
      }

      userProfile = updatedUser
    } else {
      // Create new user profile
      const newUserData: UserProfileInsert = {
        id: uuidv4(),
        line_user_id: profileData.line_user_id,
        display_name: profileData.display_name,
        picture_url: profileData.picture_url,
        // Onboarding fields will be null initially
        role: null,
        first_name: null,
        last_name: null,
        phone: null,
      }

      const { data: newUser, error: insertError } = await supabase
        .from('user_profiles')
        .insert(newUserData)
        .select()
        .single()

      if (insertError) {
        console.error('User profile creation error:', insertError)
        return NextResponse.json(
          { success: false, error: 'Failed to create user profile' },
          { status: 500 }
        )
      }

      userProfile = newUser
    }

    // Determine if user has completed onboarding
    const isOnboarded = !!(
      userProfile.role &&
      userProfile.first_name &&
      userProfile.last_name &&
      userProfile.phone
    )

    // Return user profile data
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
        is_onboarded: isOnboarded,
      },
    })
  } catch (error) {
    console.error('Unexpected error in login API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle unsupported HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}