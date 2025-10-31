import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UserData } from '@/types'
import { UserSessionManager } from '@/lib/user-session'

interface UseUserSessionResult {
  userData: UserData | null
  isLoading: boolean
  transformUserData: (user: any) => UserData
}

export function useUserSession(): UseUserSessionResult {
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const transformUserData = useCallback((user: any): UserData => ({
    first_name: user.first_name || user.displayName?.split(' ')[0] || 'User',
    last_name: user.last_name || user.displayName?.split(' ')[1] || '',
    picture_url: user.picture_url || user.pictureUrl,
    points_balance: user.points_balance || 0,
    displayName: user.displayName || user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    pictureUrl: user.pictureUrl || user.picture_url,
    role: user.role || user.user_role
  }), [])

  useEffect(() => {
    // Instant loading with cached data
    const cachedUser = UserSessionManager.getCachedUser()

    if (cachedUser) {
      // Show cached data immediately
      setUserData(transformUserData(cachedUser))
      setIsLoading(false)
    } else {
      // Fallback to old localStorage method for backward compatibility
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)
          const userData = transformUserData(user)
          setUserData(userData)
          // Migrate to new session system
          UserSessionManager.saveSession(user)
        } catch (error) {
          console.error('Error parsing user data:', error)
          router.push('/')
        }
      } else {
        // No user data, redirect to login
        router.push('/')
      }
      setIsLoading(false)
    }
  }, [router, transformUserData])

  const updateUserData = useCallback((newData: UserData) => {
    setUserData(newData)
  }, [])

  return {
    userData,
    isLoading,
    transformUserData
  }
}
