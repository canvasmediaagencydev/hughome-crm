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

// Cache for JWKS to avoid repeated requests
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null

/**
 * Get or create JWKS instance for LINE token verification
 */
function getJWKS() {
  if (!jwksCache) {
    jwksCache = createRemoteJWKSet(new URL(LINE_JWKS_URL))
  }
  return jwksCache
}

/**
 * Verify LINE ID token and extract user information
 * @param idToken The ID token from LINE Login
 * @param expectedLiffId The expected LIFF ID
 * @returns Decoded and verified token payload
 */
export async function verifyLineIdToken(
  idToken: string,
  expectedLiffId: string
): Promise<LineIdTokenPayload> {
  try {
    // First validate token format
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Invalid token format')
    }

    const tokenParts = idToken.split('.')
    if (tokenParts.length !== 3) {
      throw new Error('Invalid JWT format - token must have 3 parts')
    }

    const jwks = getJWKS()
    
    // For LIFF tokens, the audience can be either the LIFF ID or the Channel ID
    // Let's try different verification approaches
    let payload
    try {
      // Try with LIFF ID as audience
      const result = await jwtVerify(idToken, jwks, {
        issuer: 'https://access.line.me',
        audience: expectedLiffId,
      })
      payload = result.payload
    } catch (audienceError) {
      // Try with Channel ID as fallback (this is normal behavior)
      
      // Try with Channel ID (extract from LIFF ID if it follows pattern)
      const channelId = expectedLiffId.split('-')[0] // Extract channel ID from LIFF ID
      try {
        const result = await jwtVerify(idToken, jwks, {
          issuer: 'https://access.line.me',
          audience: channelId,
        })
        payload = result.payload
      } catch (channelError) {
        // Last resort: verify signature only, check audience manually
        
        // Last resort: verify signature only, check audience manually
        const result = await jwtVerify(idToken, jwks, {
          issuer: 'https://access.line.me',
          // Skip audience verification - we'll check manually
        })
        payload = result.payload
        
        // Manual audience validation
        if (payload.aud !== expectedLiffId && payload.aud !== channelId) {
          console.log(`Token audience: ${payload.aud}, Expected: ${expectedLiffId} or ${channelId}`)
          throw new Error(`Token audience ${payload.aud} does not match expected values`)
        }
      }
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
 * Validate LINE configuration
 */
export function validateLineConfig() {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID
  
  if (!liffId) {
    throw new Error('NEXT_PUBLIC_LINE_LIFF_ID environment variable is required')
  }

  return { liffId }
}