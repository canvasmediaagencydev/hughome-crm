import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { 
  createServerSupabaseClient, 
  getUserProfileOptimized,
  updateUserProfileOptimized,
  createUserProfileOptimized,
  type UserProfileInsert 
} from '@/lib/supabase-server'
import { verifyLineIdToken, extractUserProfileData, validateLineConfig } from '@/lib/line-auth'

// Performance monitoring utility
async function timeOperation<T>(
  operationName: string,
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  const startTime = Date.now()
  try {
    const result = await operation()
    const duration = Date.now() - startTime
    console.log(`⚡ ${operationName} completed in ${duration}ms`, context || {})
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`❌ ${operationName} failed after ${duration}ms`, { error, ...context })
    throw error
  }
}

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
        setTimeout(() => reject(new Error('Request parsing timeout')), 8000)
      )
    ]).catch((error) => {
      console.error('Request parsing error:', error)
      throw new Error('Invalid JSON in request body or timeout occurred')
    })
    
    console.log(`✅ API: Body parsed in ${Date.now() - parseStart}ms`)

    const { idToken } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Enhanced parallel execution with retry and timeout handling
    console.log('⏳ API: Initializing config and verifying token...')
    const parallelStart = Date.now()
    
    let tokenPayload
    let retryCount = 0
    const maxRetries = 2
    
    while (retryCount <= maxRetries) {
      try {
        const [{ liffId }, verifiedPayload] = await Promise.race([
          Promise.all([
            Promise.resolve(validateLineConfig()),
            verifyLineIdToken(idToken, process.env.NEXT_PUBLIC_LINE_LIFF_ID!)
          ]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Token verification timeout')), 15000)
          )
        ])
        
        tokenPayload = verifiedPayload
        break
      } catch (error) {
        retryCount++
        console.warn(`🔄 Token verification attempt ${retryCount} failed:`, error instanceof Error ? error.message : 'Unknown error')
        
        if (retryCount > maxRetries) {
          throw error
        }
        
        // Exponential backoff: wait longer between retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
      }
    }
    
    const profileData = extractUserProfileData(tokenPayload!)
    console.log(`✅ API: Config and token verified in ${Date.now() - parallelStart}ms (attempts: ${retryCount + 1})`)

    // Optimized user lookup with caching
    console.log('⏳ API: Checking existing user with cache...')
    const dbStart = Date.now()
    
    try {
      const existingUser = await getUserProfileOptimized(profileData.line_user_id)
      console.log(`✅ API: User check completed in ${Date.now() - dbStart}ms`)
      
      // Handle existing vs new user with smart updates and performance tracking
      const userProfile = existingUser 
        ? await timeOperation(
            'auth.user.update',
            () => updateUserProfileOptimized(profileData.line_user_id, {
              display_name: profileData.display_name,
              picture_url: profileData.picture_url,
              last_login_at: new Date().toISOString(),
            }),
            { isExistingUser: true, lineUserId: profileData.line_user_id }
          )
        : await timeOperation(
            'auth.user.create',
            () => createUserProfileOptimized({
              id: uuidv4(),
              line_user_id: profileData.line_user_id,
              display_name: profileData.display_name,
              picture_url: profileData.picture_url,
              last_login_at: new Date().toISOString(),
              role: null,
              first_name: null,
              last_name: null,
              phone: null,
            }),
            { isNewUser: true, lineUserId: profileData.line_user_id }
          )
      
      // Determine if user has completed onboarding
      const isOnboarded = !!(
        userProfile.role &&
        userProfile.first_name &&
        userProfile.last_name &&
        userProfile.phone
      )
      
      const totalTime = Date.now() - startTime
      console.log(`🎉 API: Login completed successfully in ${totalTime}ms`, {
        success: true,
        isOnboarded,
        userExists: !!existingUser,
        lineUserId: profileData.line_user_id
      })
      
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
          last_login_at: userProfile.last_login_at,
          points_balance: userProfile.points_balance || 0,
          total_points_earned: userProfile.total_points_earned || 0,
          total_receipts: userProfile.total_receipts || 0,
          is_admin: userProfile.is_admin || false,
          is_onboarded: isOnboarded,
        },
      })
    } catch (error) {
      const totalTime = Date.now() - startTime
      console.log(`❌ API: Database operation failed in ${totalTime}ms`, {
        success: false,
        error: error instanceof Error ? error.message : 'Database error'
      })
      console.error('Database operation error:', error)
      return NextResponse.json(
        { success: false, error: 'Database error occurred' },
        { status: 500 }
      )
    }
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.log(`❌ API: Unexpected error in ${totalTime}ms`, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
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


// Handle unsupported HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}