import { isUserOnboarded } from './onboarding-utils'

interface CachedUserSession {
  user: {
    id: string
    line_user_id: string
    display_name: string | null
    picture_url: string | null
    role: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
    is_onboarded: boolean
    points_balance: number
  }
  timestamp: number
  lastValidated: number
  version: number
}

const SESSION_KEY = 'hughome_user_session'
const CACHE_VERSION = 1
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const VALIDATION_INTERVAL = 60 * 60 * 1000 // 1 hour

export class UserSessionManager {
  static saveSession(userData: CachedUserSession['user']): void {
    if (typeof window === 'undefined') return
    
    const session: CachedUserSession = {
      user: userData,
      timestamp: Date.now(),
      lastValidated: Date.now(),
      version: CACHE_VERSION
    }
    
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch (error) {
      console.warn('Failed to save user session:', error)
    }
  }
  
  static getCachedSession(): CachedUserSession | null {
    if (typeof window === 'undefined') return null
    
    try {
      const stored = localStorage.getItem(SESSION_KEY)
      if (!stored) return null
      
      const session: CachedUserSession = JSON.parse(stored)
      
      // Check version compatibility
      if (session.version !== CACHE_VERSION) {
        this.clearSession()
        return null
      }
      
      // Check if cache is expired
      if (Date.now() - session.timestamp > CACHE_DURATION) {
        this.clearSession()
        return null
      }
      
      return session
    } catch (error) {
      console.warn('Failed to parse cached session:', error)
      this.clearSession()
      return null
    }
  }
  
  static isSessionValid(): boolean {
    const session = this.getCachedSession()
    return session !== null
  }
  
  static needsValidation(): boolean {
    const session = this.getCachedSession()
    if (!session) return true
    
    return Date.now() - session.lastValidated > VALIDATION_INTERVAL
  }
  
  static updateValidationTime(): void {
    const session = this.getCachedSession()
    if (!session) return
    
    session.lastValidated = Date.now()
    
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch (error) {
      console.warn('Failed to update validation time:', error)
    }
  }
  
  static clearSession(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem('user') // Clear old user data too
    } catch (error) {
      console.warn('Failed to clear session:', error)
    }
  }
  
  static getCachedUser(): CachedUserSession['user'] | null {
    const session = this.getCachedSession()
    return session?.user || null
  }
  
  static isUserDataComplete(user: CachedUserSession['user']): boolean {
    // Use shared utility function to ensure consistency
    return isUserOnboarded(user)
  }

  static updateUserData(updates: Partial<CachedUserSession['user']>): void {
    const session = this.getCachedSession()
    if (!session) return

    session.user = { ...session.user, ...updates }

    // Auto-calculate is_onboarded using shared utility
    session.user.is_onboarded = isUserOnboarded(session.user)

    session.timestamp = Date.now()

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      // Also update the old format for backward compatibility
      localStorage.setItem('user', JSON.stringify(session.user))
    } catch (error) {
      console.warn('Failed to update user data:', error)
    }
  }
  
  // Migration helper for existing localStorage data
  static migrateOldUserData(): void {
    if (typeof window === 'undefined') return
    
    const oldUser = localStorage.getItem('user')
    if (!oldUser || this.getCachedSession()) return
    
    try {
      const userData = JSON.parse(oldUser)
      // Check if it has the expected structure
      if (userData.id && userData.line_user_id) {
        this.saveSession(userData)
      }
    } catch (error) {
      console.warn('Failed to migrate old user data:', error)
    }
  }
}

// Helper hook for React components
export const useUserSession = () => {
  if (typeof window === 'undefined') {
    return {
      cachedUser: null,
      isSessionValid: false,
      needsValidation: true,
      clearSession: () => {},
      updateUserData: () => {}
    }
  }
  
  return {
    cachedUser: UserSessionManager.getCachedUser(),
    isSessionValid: UserSessionManager.isSessionValid(),
    needsValidation: UserSessionManager.needsValidation(),
    clearSession: UserSessionManager.clearSession,
    updateUserData: UserSessionManager.updateUserData
  }
}
