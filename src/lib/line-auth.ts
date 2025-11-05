// Simple LINE token verification
interface LineProfile {
  sub: string // LINE user ID
  name: string
  picture: string
}

export async function verifyLineIdToken(idToken: string): Promise<LineProfile> {
  try {
    // Validate token format
    if (!idToken || typeof idToken !== 'string') {
      console.error('LINE token is missing or invalid type')
      throw new Error('Invalid LINE token: missing or wrong type')
    }

    const parts = idToken.split('.')
    if (parts.length !== 3) {
      console.error('LINE token does not have 3 parts:', parts.length)
      throw new Error('Invalid LINE token: incorrect format')
    }

    // In a real app, you would verify the token with LINE's JWKS endpoint
    // For now, we'll just decode the JWT payload (unsafe for production!)
    // Use Buffer in Node.js instead of atob (browser API)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'))

    // Validate required fields
    if (!payload.sub) {
      console.error('LINE token missing sub field:', payload)
      throw new Error('Invalid LINE token: missing user ID')
    }

    return {
      sub: payload.sub,
      name: payload.name || '',
      picture: payload.picture || ''
    }
  } catch (error) {
    console.error('LINE token verification failed:', error)
    if (error instanceof Error && error.message.startsWith('Invalid LINE token')) {
      throw error
    }
    throw new Error('Invalid LINE token: parsing failed')
  }
}

export function extractUserProfileData(tokenPayload: LineProfile) {
  return {
    line_user_id: tokenPayload.sub,
    display_name: tokenPayload.name,
    picture_url: tokenPayload.picture
  }
}