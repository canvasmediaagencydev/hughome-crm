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
  const [showWelcome, setShowWelcome] = useState(true)
  const router = useRouter()

  const authenticateWithBackend = async (profile: any, forceValidation = false, retryCount = 0) => {
    const maxRetries = 2
    
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
      
      // Retry for 500 errors (server errors)
      if (apiError.response?.status === 500 && retryCount < maxRetries) {
        console.log(`Login API 500 error, retrying... (${retryCount + 1}/${maxRetries})`)
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
        return authenticateWithBackend(profile, forceValidation, retryCount + 1)
      }
      return false
    }
  }

  const main = async () => {
    try {
      // First, migrate any old localStorage data
      UserSessionManager.migrateOldUserData()

      // REMOVED FAST PATH - Always validate with backend before redirecting
      // This prevents race conditions where cached data is stale

      await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })

      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()

        // Always authenticate with backend to get fresh user state
        // This ensures is_onboarded status is accurate
        const success = await authenticateWithBackend(profile)

        if (!success) {
          // Backend authentication failed - clear cache and show error
          UserSessionManager.clearSession()
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      main()
    }
  }, [])

  // Welcome message timer - show for 1 second then switch to loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          {showWelcome ? (
            // Welcome message - first 1 second
            <div className="animate-fade-in">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                ยินดีต้อนรับสู่ Hughome
              </h1>
            </div>
          ) : (
            // Loading spinner - after 1 second
            <div className="space-y-6 animate-fade-in">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin"></div>
              </div>
              <p className="text-base sm:text-lg text-gray-600">
                กำลังเข้าสู่ระบบ...
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }
}