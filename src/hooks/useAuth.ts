'use client'

import { useState, useCallback } from 'react'
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
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { isLiffReady, isLoggedIn, getIdToken, login: liffLogin } = useLiff()

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const login = useCallback(async () => {
    if (!isLiffReady) {
      setError('LIFF is not ready yet')
      return
    }

    if (!isLoggedIn) {
      // Redirect to LINE login
      liffLogin()
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const idToken = await getIdToken()
      if (!idToken) {
        throw new Error('Failed to get ID token')
      }

      const response = await fetch('/api/liff/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })

      const data: LoginResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Login failed')
      }

      if (data.user) {
        setUser(data.user)
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          ...formData,
        }),
      })

      const data: UpdateProfileResponse = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Profile update failed')
      }

      if (data.user) {
        setUser(data.user)
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