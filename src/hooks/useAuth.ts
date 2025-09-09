'use client'

import { useState, useCallback, useRef } from 'react'
import { useLiff } from './useLiff'
import type { User, LoginResponse, UpdateProfileResponse, OnboardingFormData } from '@/types/user'

interface UseAuthReturn {
  user: User | null
  isLoading: boolean
  error: string | null
  login: () => Promise<void>
  updateProfile: (data: OnboardingFormData) => Promise<void>
  clearError: () => void
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user from sessionStorage
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('hughome_user')
      if (saved) {
        try {
          const userData = JSON.parse(saved)
          console.log('📦 Restored user from persistent cache:', userData.display_name)
          return userData
        } catch {
          console.log('🗑️ Invalid cache data, clearing...')
          sessionStorage.removeItem('hughome_user')
        }
      }
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { isLiffReady, isLoggedIn, getIdToken, login: liffLogin } = useLiff()
  
  // Prevent concurrent requests
  const loginPromiseRef = useRef<Promise<void> | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])


  const login = useCallback(async () => {
    // Return existing promise if already logging in
    if (loginPromiseRef.current) {
      return loginPromiseRef.current
    }

    if (!isLiffReady) {
      setError('LIFF is not ready')
      return
    }

    if (!isLoggedIn) {
      liffLogin()
      return
    }

    // Create new login promise
    loginPromiseRef.current = (async () => {
      const startTime = Date.now()
      console.log('🚀 Starting login process...')
      
      setIsLoading(true)
      setError(null)

      try {
        console.log('⏳ Getting ID token...')
        const idToken = await getIdToken()
        if (!idToken) {
          throw new Error('Failed to get ID token')
        }
        console.log('✅ ID token obtained')

        console.log('⏳ Calling login API...')
        const response = await fetch('/api/liff/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        console.log('✅ API response received')
        const data: LoginResponse = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Login failed')
        }

        if (data.user) {
          setUser(data.user)
          // Cache user data for persistent login
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('hughome_user', JSON.stringify(data.user))
            console.log('💾 User data cached for persistent session')
          }
        }
        
        const duration = Date.now() - startTime
        console.log(`🎉 Login completed successfully in ${duration}ms`)
      } catch (err) {
        console.error('Login error:', err)
        setError(err instanceof Error ? err.message : 'Login failed')
        throw err // Re-throw to allow callers to handle
      } finally {
        setIsLoading(false)
        loginPromiseRef.current = null // Clear the promise
      }
    })()

    return loginPromiseRef.current
  }, [isLiffReady, isLoggedIn, getIdToken, liffLogin])

  const updateProfile = useCallback(async (formData: OnboardingFormData) => {
    if (!isLiffReady || !isLoggedIn) {
      setError('Please login first')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get ID token')
      }

      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, ...formData }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data: UpdateProfileResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Profile update failed')
      }

      if (data.user) {
        setUser(data.user)
        // Update cached user data
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('hughome_user', JSON.stringify(data.user))
          console.log('💾 User profile updated in persistent cache')
        }
      }
    } catch (err) {
      console.error('Profile update error:', err)
      setError(err instanceof Error ? err.message : 'Profile update failed')
    } finally {
      setIsLoading(false)
    }
  }, [isLiffReady, isLoggedIn, getIdToken])

  return {
    user,
    isLoading,
    error,
    login,
    updateProfile,
    clearError,
  }
}