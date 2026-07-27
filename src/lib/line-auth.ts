/**
 * LINE ID token verification — MIGRATION_PLAN.md §6.1
 *
 * Real cryptographic verification (was: decode-only, forgeable). Uses jose to:
 *   - verify the signature against LINE's JWKS (https://api.line.me/oauth2/v2.1/certs)
 *   - require iss === 'https://access.line.me'
 *   - require aud === LINE_CHANNEL_ID (this instance's Login channel — blocks
 *     tokens minted for a different channel/instance)
 *   - require a non-expired token (exp)
 * Any failure throws — never returns a partial/empty profile.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { serverEnv } from '@/config/env'

const LINE_ISSUER = 'https://access.line.me'
const LINE_JWKS_URL = 'https://api.line.me/oauth2/v2.1/certs'

export interface LineProfile {
  sub: string // LINE user ID
  name: string
  picture: string
}

// Memoized remote key set — jose caches the fetched keys (no fetch per request).
let cachedJwks: JWTVerifyGetKey | null = null
function lineJwks(): JWTVerifyGetKey {
  if (!cachedJwks) cachedJwks = createRemoteJWKSet(new URL(LINE_JWKS_URL))
  return cachedJwks
}

/**
 * Verify a LINE ID token. `jwks` is injectable for tests (default = LINE's).
 */
export async function verifyLineIdToken(
  idToken: string,
  jwks: JWTVerifyGetKey = lineJwks(),
): Promise<LineProfile> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Invalid LINE token: missing or wrong type')
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: LINE_ISSUER,
    audience: serverEnv.LINE_CHANNEL_ID,
  })

  if (!payload.sub) {
    throw new Error('Invalid LINE token: missing user ID (sub)')
  }

  return {
    sub: payload.sub,
    name: (payload.name as string) || '',
    picture: (payload.picture as string) || '',
  }
}

export function extractUserProfileData(tokenPayload: LineProfile) {
  return {
    line_user_id: tokenPayload.sub,
    display_name: tokenPayload.name,
    picture_url: tokenPayload.picture,
  }
}
