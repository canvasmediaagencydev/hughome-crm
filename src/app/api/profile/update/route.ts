import { NextRequest, NextResponse } from 'next/server'
import { 
  getUserProfileOptimized, 
  updateUserProfileOptimized, 
  type UserProfileUpdate,
  clearUserProfileCache 
} from '@/lib/supabase-server'
import { verifyLineIdToken, validateLineConfig } from '@/lib/line-auth'
import { withRequestDeduplication, withPerformanceMonitoring, withRateLimit } from '@/lib/api-performance'

interface UpdateProfileRequestBody {
  idToken: string
  role?: 'contractor' | 'homeowner'
  first_name?: string
  last_name?: string
  phone?: string
}

interface UpdateProfileResponse {
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
    last_login_at: string | null
    points_balance: number | null
    total_points_earned: number | null
    total_receipts: number | null
    is_admin: boolean | null
    is_onboarded: boolean
  }
  error?: string
}

/**
 * Validate phone number format (basic validation)
 */
function validatePhoneNumber(phone: string): boolean {
  // Basic phone validation - adjust pattern as needed for your requirements
  const phoneRegex = /^[\+]?[\d\-\s\(\)]+$/
  return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20
}

/**
 * Validate name fields (basic validation)
 */
function validateName(name: string): boolean {
  return name.trim().length >= 1 && name.trim().length <= 100
}

// Raw handler without middleware
async function updateProfileHandler(request: NextRequest): Promise<NextResponse<UpdateProfileResponse>> {
  const startTime = Date.now()
  
  try {
    // Parse request body with timeout
    let body: UpdateProfileRequestBody
    try {
      body = await Promise.race([
        request.json(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        )
      ])
    } catch (error) {
      console.error('Profile update request parsing error:', error)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body or timeout' },
        { status: 400 }
      )
    }

    const { idToken, role, first_name, last_name, phone } = body

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID token is required' },
        { status: 400 }
      )
    }

    // Validate LINE configuration
    const { liffId } = validateLineConfig()

    // Verify the LINE ID token to authenticate the user
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

    // Validate input fields
    const validationErrors: string[] = []

    if (role && !['contractor', 'homeowner'].includes(role)) {
      validationErrors.push('Role must be either "contractor" or "homeowner"')
    }

    if (first_name !== undefined) {
      if (!first_name || typeof first_name !== 'string' || !validateName(first_name)) {
        validationErrors.push('First name must be a valid string between 1-100 characters')
      }
    }

    if (last_name !== undefined) {
      if (!last_name || typeof last_name !== 'string' || !validateName(last_name)) {
        validationErrors.push('Last name must be a valid string between 1-100 characters')
      }
    }

    if (phone !== undefined) {
      if (!phone || typeof phone !== 'string' || !validatePhoneNumber(phone)) {
        validationErrors.push('Phone number must be a valid phone number')
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: validationErrors.join('; ') },
        { status: 400 }
      )
    }

    // Use optimized user profile lookup with caching
    const existingUser = await getUserProfileOptimized(tokenPayload.sub)

    if (!existingUser) {
      console.error('User profile not found:', tokenPayload.sub)
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Prepare update data - only include fields that were provided
    const updateData: UserProfileUpdate = {
      updated_at: new Date().toISOString(),
    }

    if (role !== undefined) {
      updateData.role = role
    }

    if (first_name !== undefined) {
      updateData.first_name = first_name.trim()
    }

    if (last_name !== undefined) {
      updateData.last_name = last_name.trim()
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim()
    }

    // Use optimized profile update with intelligent caching
    const updatedUser = await updateUserProfileOptimized(tokenPayload.sub, updateData)

    // Determine if user has completed onboarding
    const isOnboarded = !!(
      updatedUser.role &&
      updatedUser.first_name &&
      updatedUser.last_name &&
      updatedUser.phone
    )

    // Log performance metrics
    const duration = Date.now() - startTime
    console.log(`✅ Profile update completed in ${duration}ms`, {
      lineUserId: tokenPayload.sub,
      fieldsUpdated: Object.keys(updateData).filter(k => k !== 'updated_at'),
      isOnboarded
    })

    // Return updated user profile
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
        last_login_at: updatedUser.last_login_at,
        points_balance: updatedUser.points_balance || 0,
        total_points_earned: updatedUser.total_points_earned || 0,
        total_receipts: updatedUser.total_receipts || 0,
        is_admin: updatedUser.is_admin || false,
        is_onboarded: isOnboarded,
      },
    })
  } catch (error) {
    console.error('Unexpected error in profile update API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Enhanced POST handler with performance optimizations
export const POST = withRateLimit(30, 60000)(  // 30 profile updates per minute
  withRequestDeduplication(
    withPerformanceMonitoring(updateProfileHandler, 'profile.update'),
    (request: NextRequest) => {
      // Custom key for profile updates - include auth header for user-specific deduplication
      const authHeader = request.headers.get('authorization')
      return `profile-update:${authHeader?.slice(0, 30) || 'no-auth'}`
    }
  )
)

// Handle unsupported HTTP methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, error: 'Method not allowed' },
    { status: 405 }
  )
}