'use client'

export interface SessionData {
  lineUserId: string
  userId: string
  isOnboarded: boolean
  timestamp: number
}

const SESSION_KEY = 'hughome_auth'
const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Set session data in cookies and localStorage
 */
export function setSession(data: Omit<SessionData, 'timestamp'>) {
  if (typeof window === 'undefined') return
  
  const sessionData: SessionData = {
    ...data,
    timestamp: Date.now()
  }
  
  // Set in localStorage for client-side access
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
  
  // Set cookie for server-side middleware
  document.cookie = `${SESSION_KEY}=${JSON.stringify(sessionData)}; path=/; max-age=${SESSION_TTL / 1000}; SameSite=Strict; Secure=${location.protocol === 'https:'}`
}

/**
 * Get session data from localStorage
 */
export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return null
    
    const session: SessionData = JSON.parse(stored)
    
    // Check if session is expired
    if (Date.now() - session.timestamp > SESSION_TTL) {
      clearSession()
      return null
    }
    
    return session
  } catch (error) {
    console.warn('Failed to parse session data:', error)
    clearSession()
    return null
  }
}

/**
 * Clear session data (internal use only - LIFF apps typically don't need logout)
 */
export function clearSession() {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('hughome_user') // Clear user cache too
  sessionStorage.removeItem('hughome_user')
  
  // Clear cookie
  document.cookie = `${SESSION_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`
}

/**
 * Update session onboarding status
 */
export function updateSessionOnboardingStatus(isOnboarded: boolean) {
  const session = getSession()
  if (session) {
    setSession({
      ...session,
      isOnboarded
    })
  }
}