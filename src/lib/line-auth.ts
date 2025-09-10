// Simple LINE token verification
interface LineProfile {
  sub: string // LINE user ID
  name: string
  picture: string
}

export async function verifyLineIdToken(idToken: string): Promise<LineProfile> {
  try {
    // In a real app, you would verify the token with LINE's JWKS endpoint
    // For now, we'll just decode the JWT payload (unsafe for production!)
    const payload = JSON.parse(atob(idToken.split('.')[1]))
    
    return {
      sub: payload.sub,
      name: payload.name,
      picture: payload.picture
    }
  } catch (error) {
    throw new Error('Invalid LINE token')
  }
}

export function extractUserProfileData(tokenPayload: LineProfile) {
  return {
    line_user_id: tokenPayload.sub,
    display_name: tokenPayload.name,
    picture_url: tokenPayload.picture
  }
}