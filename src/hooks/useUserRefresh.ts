import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { UserData } from '@/types'
import { UserSessionManager } from '@/lib/user-session'

interface UseUserRefreshParams {
  onSuccess?: (updatedData: UserData) => void
  transformUserData: (user: any) => UserData
}

export function useUserRefresh({ onSuccess, transformUserData }: UseUserRefreshParams) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  const refreshUserData = useCallback(async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      const cachedSession = UserSessionManager.getCachedSession()
      if (cachedSession) {
        const response = await axios.post('/api/user/refresh', {
          userId: cachedSession.user.id
        })

        if (response.data.success) {
          const updatedUser = { ...cachedSession.user, ...response.data.updates }
          UserSessionManager.updateUserData(updatedUser)
          const transformedData = transformUserData(updatedUser)

          // Check if user needs to complete onboarding after refresh
          if (!updatedUser.is_onboarded) {
            router.push('/onboarding')
            return
          }

          onSuccess?.(transformedData)
        }
      }
    } catch (error: any) {
      console.warn('Failed to refresh user data:', error)

      // If user not found in database (404), logout and redirect to login
      if (error.response?.status === 404) {
        console.log('User not found in database, logging out and redirecting to login')
        UserSessionManager.clearSession()

        // Logout from LINE LIFF and redirect to login page
        try {
          const liff = (await import('@line/liff')).default
          await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })
          if (liff.isLoggedIn()) {
            liff.logout()
          }
        } catch (liffError) {
          console.warn('LIFF logout failed:', liffError)
        }

        router.push('/')
        return
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, router, transformUserData, onSuccess])

  return {
    isRefreshing,
    refreshUserData
  }
}
