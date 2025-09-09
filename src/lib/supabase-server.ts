import { createClient } from '@supabase/supabase-js'
import { Database } from '../../database.types'

// Cache the Supabase client to avoid recreating it
let supabaseServerClient: ReturnType<typeof createClient<Database>> | null = null

// User profile cache with TTL for faster lookups
interface CachedUserProfile {
  data: Database['public']['Tables']['user_profiles']['Row'] | null
  timestamp: number
  ttl: number
}

const userProfileCache = new Map<string, CachedUserProfile>()
const USER_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE = 1000 // Prevent memory leaks

// Server-side Supabase client with service role key for admin operations
export const createServerSupabaseClient = () => {
  if (supabaseServerClient) {
    return supabaseServerClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseServerClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'connection': 'keep-alive',
        'keep-alive-timeout': '600',
        'x-connection-pool': 'true',
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  })

  return supabaseServerClient
}

/**
 * Get user profile from cache or database with intelligent caching
 */
export const getUserProfileOptimized = async (
  lineUserId: string
): Promise<Database['public']['Tables']['user_profiles']['Row'] | null> => {
  const now = Date.now()
  
  // Check cache first
  const cached = userProfileCache.get(lineUserId)
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return cached.data
  }
  
  // Cache miss or expired - fetch from database
  const supabase = createServerSupabaseClient()
  
  // Use optimized query with specific field selection and prepared statement pattern
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, line_user_id, display_name, picture_url, role, first_name, last_name, phone, created_at, updated_at')
    .eq('line_user_id', lineUserId)
    .maybeSingle()
  
  if (error) {
    throw error
  }
  
  // Cache the result (including null results to prevent repeated DB calls)
  if (userProfileCache.size >= MAX_CACHE_SIZE) {
    // Simple LRU: remove oldest entries
    const oldestKey = userProfileCache.keys().next().value
    if (oldestKey) {
      userProfileCache.delete(oldestKey)
    }
  }
  
  userProfileCache.set(lineUserId, {
    data: data,
    timestamp: now,
    ttl: data ? USER_CACHE_TTL : 30000 // Cache null results for 30s to prevent DB hammering
  })
  
  return data
}

/**
 * Update user profile with cache invalidation
 */
export const updateUserProfileOptimized = async (
  lineUserId: string,
  updates: Database['public']['Tables']['user_profiles']['Update']
): Promise<Database['public']['Tables']['user_profiles']['Row']> => {
  const supabase = createServerSupabaseClient()
  
  // Only update if there are actual changes
  const currentProfile = await getUserProfileOptimized(lineUserId)
  if (!currentProfile) {
    throw new Error('User profile not found')
  }
  
  // Check if update is actually needed
  const needsUpdate = Object.entries(updates).some(([key, value]) => {
    return currentProfile[key as keyof typeof currentProfile] !== value
  })
  
  if (!needsUpdate) {
    return currentProfile // No changes needed
  }
  
  const { data: updatedUser, error: updateError } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('line_user_id', lineUserId)
    .select()
    .single()
  
  if (updateError) {
    throw updateError
  }
  
  // Invalidate cache
  userProfileCache.delete(lineUserId)
  
  return updatedUser
}

/**
 * Create new user profile with cache warming
 */
export const createUserProfileOptimized = async (
  profileData: Database['public']['Tables']['user_profiles']['Insert']
): Promise<Database['public']['Tables']['user_profiles']['Row']> => {
  const supabase = createServerSupabaseClient()
  
  const { data: newUser, error: insertError } = await supabase
    .from('user_profiles')
    .insert(profileData)
    .select()
    .single()
  
  if (insertError) {
    throw insertError
  }
  
  // Warm the cache with new user data
  userProfileCache.set(newUser.line_user_id, {
    data: newUser,
    timestamp: Date.now(),
    ttl: USER_CACHE_TTL
  })
  
  return newUser
}

// Client-side Supabase client with anon key for RLS-protected operations
export const createClientSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

// User profile type for easier usage
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

// Cache management utilities
export const clearUserProfileCache = (lineUserId?: string) => {
  if (lineUserId) {
    userProfileCache.delete(lineUserId)
  } else {
    userProfileCache.clear()
  }
}

export const getCacheStats = () => {
  return {
    size: userProfileCache.size,
    maxSize: MAX_CACHE_SIZE,
    entries: Array.from(userProfileCache.entries()).map(([key, value]) => ({
      lineUserId: key,
      cached: new Date(value.timestamp).toISOString(),
      ttl: value.ttl
    }))
  }
}