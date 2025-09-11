'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import liff from '@line/liff'
import axios from 'axios'
import { UserSessionManager } from '@/lib/user-session'

interface User {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}


export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const authenticateWithBackend = async (profile: any, forceValidation = false) => {
    try {
      const idToken = liff.getIDToken()
      const response = await axios.post('/api/liff/login', {
        idToken,
        skipDbUpdate: !forceValidation && !UserSessionManager.needsValidation()
      })
      
      const data = response.data
      if (data.success && data.user) {
        const userData = {
          ...profile,
          ...data.user
        }
        
        // Save to new session system
        UserSessionManager.saveSession(userData)
        // Keep backward compatibility
        localStorage.setItem('user', JSON.stringify(userData))
        
        // Check if user needs onboarding
        if (!data.user.is_onboarded) {
          router.push('/onboarding')
        } else {
          router.push('/dashboard')
        }
        return true
      }
      return false
    } catch (apiError: any) {
      console.error('API authentication failed:', apiError)
      
      // If user not found in database, logout and retry login
      if (apiError.response?.status === 404) {
        console.log('User not found in database during login, logging out and retrying')
        UserSessionManager.clearSession()
        
        // Logout from LINE LIFF to force fresh login
        try {
          if (liff.isLoggedIn()) {
            liff.logout()
            // After logout, LIFF will redirect to login automatically
            return false
          }
        } catch (liffError) {
          console.warn('LIFF logout failed:', liffError)
        }
        
        return false
      }
      
      return false
    }
  }

  const handleCachedUser = () => {
    const cachedUser = UserSessionManager.getCachedUser()
    if (cachedUser) {
      // Instant redirect for cached users
      if (!cachedUser.is_onboarded) {
        router.push('/onboarding')
      } else {
        router.push('/dashboard')
      }
      return true
    }
    return false
  }

  const main = async () => {
    try {
      // First, migrate any old localStorage data
      UserSessionManager.migrateOldUserData()
      
      // Check cached session first for instant redirect
      if (handleCachedUser()) {
        setIsLoading(false)
        return
      }

      await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })
      
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()
        
        // Try to authenticate with backend
        const success = await authenticateWithBackend(profile)
        
        if (!success) {
          setUser(profile) // Fallback to show LINE profile
        }
      } else {
        liff.login()
      }
    } catch (error) {
      console.error('LIFF initialization error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Background validation for cached users
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedUser = UserSessionManager.getCachedUser()
      
      if (cachedUser && UserSessionManager.needsValidation()) {
        // Background validation - don't block UI
        const validateInBackground = async () => {
          try {
            await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })
            
            if (liff.isLoggedIn()) {
              const profile = await liff.getProfile()
              await authenticateWithBackend(profile, true)
              UserSessionManager.updateValidationTime()
            } else {
              // User not logged in to LINE anymore
              UserSessionManager.clearSession()
            }
          } catch (error) {
            console.warn('Background validation failed:', error)
          }
        }
        
        // Run validation in background after a short delay
        setTimeout(validateInBackground, 100)
      }
      
      main()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="py-70 flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin duration-1000"></div>
          </div>
        </div>
      </div>
    )
  }
}