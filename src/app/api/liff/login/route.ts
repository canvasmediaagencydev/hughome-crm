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
  const startTime = Date.now()
  console.log('🚀 API: Starting login process...')
  
  try {
    // Parse request body with timeout
    console.log('⏳ API: Parsing request body...')
    const parseStart = Date.now()
    
    const body: LoginRequestBody = await Promise.race([
      request.json(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      )
    ]).catch(() => {
      throw new Error('Invalid JSON in request body')
    })
    
    console.log(`✅ API: Body parsed in ${Date.now() - parseStart}ms`)

    const { idToken } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Parallel execution: validate config and initialize Supabase
    console.log('⏳ API: Initializing config and Supabase...')
    const configStart = Date.now()
    
    const [{ liffId }, supabase] = await Promise.all([
      Promise.resolve(validateLineConfig()),
      Promise.resolve(createServerSupabaseClient())
    ])
    
    console.log(`✅ API: Config and Supabase initialized in ${Date.now() - configStart}ms`)

    // Verify the LINE ID token and extract profile data
    console.log('⏳ API: Verifying LINE token...')
    const tokenStart = Date.now()
    
    const tokenPayload = await verifyLineIdToken(idToken, liffId)
    const profileData = extractUserProfileData(tokenPayload)
    
    console.log(`✅ API: Token verified in ${Date.now() - tokenStart}ms`)

    // Check if user already exists (select only needed fields)
    console.log('⏳ API: Checking existing user...')
    const dbStart = Date.now()
    
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, line_user_id, display_name, picture_url, role, first_name, last_name, phone, created_at, updated_at')
      .eq('line_user_id', profileData.line_user_id)
      .maybeSingle() // Use maybeSingle() instead of single() to avoid throwing on no results

    if (fetchError) {
      console.error('Database fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: 'Database error occurred' },
        { status: 500 }
      )
    }
    
    console.log(`✅ API: User check completed in ${Date.now() - dbStart}ms`)

    // Handle existing vs new user
    console.log(`⏳ API: ${existingUser ? 'Updating existing' : 'Creating new'} user...`)
    const userOpStart = Date.now()
    
    const userProfile = await (existingUser 
      ? updateExistingUser(supabase, profileData)
      : createNewUser(supabase, profileData)
    )
    
    console.log(`✅ API: User operation completed in ${Date.now() - userOpStart}ms`)

    // Determine if user has completed onboarding
    const isOnboarded = !!(
      userProfile.role &&
      userProfile.first_name &&
      userProfile.last_name &&
      userProfile.phone
    )

    const totalTime = Date.now() - startTime
    console.log(`🎉 API: Login completed successfully in ${totalTime}ms`)
    
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
    
    if (error instanceof Error && error.message.includes('token verification failed')) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired LINE token' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function for updating existing user
async function updateExistingUser(supabase: any, profileData: any) {
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
    throw new Error('Failed to update user profile')
  }

  return updatedUser
}

// Helper function for creating new user
async function createNewUser(supabase: any, profileData: any) {
  const newUserData: UserProfileInsert = {
    id: uuidv4(),
    line_user_id: profileData.line_user_id,
    display_name: profileData.display_name,
    picture_url: profileData.picture_url,
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
    throw new Error('Failed to create user profile')
  }

  return newUser
}

// Handle unsupported HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}