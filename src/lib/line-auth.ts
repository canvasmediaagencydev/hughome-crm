import { jwtVerify, createRemoteJWKSet } from 'jose'

// LINE's JWKS endpoint for verifying ID tokens
const LINE_JWKS_URL = 'https://api.line.me/oauth2/v2.1/certs'

// Types for LINE ID token payload
export interface LineIdTokenPayload {
  iss: string // Issuer (https://access.line.me)
  sub: string // LINE user ID
  aud: string // Channel ID
  exp: number // Expiration time
  iat: number // Issued at
  nonce?: string // Optional nonce
  amr?: string[] // Authentication methods reference (optional)
  name: string // Display name
  picture: string // Profile picture URL
  email?: string // Email (if available)
}

// Enhanced caching for JWKS and LINE config
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null
let jwksCacheTime = 0
const JWKS_CACHE_TTL = 3600000 // 1 hour in milliseconds

// Cache validated LINE config to avoid repeated env var access
let lineConfigCache: { liffId: string; channelId: string } | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 300000 // 5 minutes

// Token validation result cache (short TTL for security)
const tokenValidationCache = new Map<string, { result: LineIdTokenPayload; timestamp: number }>()
const TOKEN_CACHE_TTL = 60000 // 1 minute
const MAX_TOKEN_CACHE_SIZE = 100

/**
 * Get or create JWKS instance for LINE token verification with TTL
 */
function getJWKS() {
  const now = Date.now()
  
  // Check if cache is expired
  if (jwksCache && (now - jwksCacheTime) > JWKS_CACHE_TTL) {
    console.log('JWKS cache expired, clearing...')
    jwksCache = null
  }
  
  if (!jwksCache) {
    console.log('Creating new JWKS instance...')
    jwksCache = createRemoteJWKSet(new URL(LINE_JWKS_URL), {
      timeoutDuration: 10000, // Increased to 10 seconds
      cooldownDuration: 15000, // Reduced cooldown for faster retry
      cacheMaxAge: JWKS_CACHE_TTL, // Explicit cache duration
    })
    jwksCacheTime = now
  }
  
  return jwksCache
}

/**
 * Verify LINE ID token and extract user information with caching
 * @param idToken The ID token from LINE Login
 * @param expectedLiffId The expected LIFF ID (optional, will get from config if not provided)
 * @returns Decoded and verified token payload
 */
export async function verifyLineIdToken(
  idToken: string,
  expectedLiffId?: string
): Promise<LineIdTokenPayload> {
  try {
    // First validate token format
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Invalid token format')
    }

    // Handle desktop development mock token
    if (idToken.includes('mock-signature-for-development')) {
      console.warn('🖥️ Processing mock token for desktop development')
      const [, payloadBase64] = idToken.split('.')
      const mockPayload = JSON.parse(atob(payloadBase64))
      
      return {
        iss: mockPayload.iss,
        sub: mockPayload.sub,
        aud: mockPayload.aud,
        exp: mockPayload.exp,
        iat: mockPayload.iat,
        name: mockPayload.name,
        picture: mockPayload.picture
      } as LineIdTokenPayload
    }

    // Check token cache first (short TTL for security)
    const now = Date.now()
    const cached = tokenValidationCache.get(idToken)
    if (cached && (now - cached.timestamp) < TOKEN_CACHE_TTL) {
      return cached.result
    }

    const tokenParts = idToken.split('.')
    if (tokenParts.length !== 3) {
      throw new Error('Invalid JWT format - token must have 3 parts')
    }

    // Get configuration (use cached if available)
    const { liffId, channelId } = expectedLiffId 
      ? { liffId: expectedLiffId, channelId: expectedLiffId.split('-')[0] }
      : validateLineConfig()

    const jwks = getJWKS()
    
    // Optimized verification with timeout and retry logic
    let payload
    const verificationOptions = [
      { audience: channelId, label: 'channelId' },
      { audience: liffId, label: 'liffId' },
    ]
    
    let lastError: Error | null = null
    
    for (const { audience, label } of verificationOptions) {
      try {
        const result = await Promise.race([
          jwtVerify(idToken, jwks, {
            issuer: 'https://access.line.me',
            audience,
          }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('JWT verification timeout')), 8000)
          )
        ])
        payload = result.payload
        console.log(`✅ Token verified successfully with ${label}`)
        break
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown verification error')
        console.log(`❌ Token verification failed with ${label}:`, lastError.message)
        continue
      }
    }
    
    // If all attempts failed, throw the last error
    if (!payload) {
      throw lastError || new Error('All token verification attempts failed')
    }

    // Validate required claims
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Invalid or missing LINE user ID in token')
    }

    if (!payload.name || typeof payload.name !== 'string') {
      throw new Error('Invalid or missing display name in token')
    }

    if (!payload.picture || typeof payload.picture !== 'string') {
      throw new Error('Invalid or missing picture URL in token')
    }

    // Validate and return typed payload
    const linePayload = payload as unknown as LineIdTokenPayload
    
    if (linePayload.amr && !Array.isArray(linePayload.amr)) {
      throw new Error('Invalid authentication methods reference in token')
    }
    
    // Cache the validation result
    if (tokenValidationCache.size >= MAX_TOKEN_CACHE_SIZE) {
      // Simple cleanup: remove oldest entries
      const oldestKey = tokenValidationCache.keys().next().value
      if (oldestKey) {
        tokenValidationCache.delete(oldestKey)
      }
    }
    
    tokenValidationCache.set(idToken, {
      result: linePayload,
      timestamp: now
    })
    
    return linePayload
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`LINE token verification failed: ${error.message}`)
    }
    throw new Error('LINE token verification failed: Unknown error')
  }
}

/**
 * Extract LINE user information for profile creation/update
 * @param tokenPayload Verified LINE token payload
 * @returns User profile data for database operations
 */
export function extractUserProfileData(tokenPayload: LineIdTokenPayload) {
  return {
    line_user_id: tokenPayload.sub,
    display_name: tokenPayload.name,
    picture_url: tokenPayload.picture,
  }
}

/**
 * Validate LINE configuration with caching
 */
export function validateLineConfig() {
  const now = Date.now()
  
  // Return cached config if still valid
  if (lineConfigCache && (now - configCacheTime) < CONFIG_CACHE_TTL) {
    return lineConfigCache
  }
  
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID
  
  if (!liffId) {
    throw new Error('NEXT_PUBLIC_LINE_LIFF_ID environment variable is required')
  }
  
  // Extract channel ID from LIFF ID (format: channelId-randomstring)
  const channelId = liffId.split('-')[0]
  
  // Cache the configuration
  lineConfigCache = { liffId, channelId }
  configCacheTime = now
  
  return lineConfigCache
}