'use client'

import { useState, useEffect, useCallback } from 'react'
import liff from '@line/liff'

interface UseLiffReturn {
  isLiffReady: boolean
  isLoggedIn: boolean
  isInClient: boolean
  error: string | null
  login: () => void
  getIdToken: () => Promise<string | null>
  getUserProfile: () => Promise<any>
}

export function useLiff(): UseLiffReturn {
  const [isLiffReady, setIsLiffReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isInClient, setIsInClient] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize LIFF with timeout
  useEffect(() => {
    const initializeLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID
        if (!liffId) {
          throw new Error('LINE LIFF ID is not configured')
        }

        // Add timeout to LIFF initialization
        const initPromise = liff.init({
          liffId,
          withLoginOnExternalBrowser: true
        })

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LIFF initialization timeout')), 10000)
        )

        await Promise.race([initPromise, timeoutPromise])

        setIsLiffReady(true)
        setIsLoggedIn(liff.isLoggedIn())
        setIsInClient(liff.isInClient())
        setError(null)
      } catch (err) {
        console.error('LIFF initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize LIFF')
        setIsLiffReady(false)
      }
    }

    if (typeof window !== 'undefined') {
      initializeLiff()
    }
  }, [])

  const login = useCallback(() => {
    if (!isLiffReady) return
    
    try {
      if (!liff.isLoggedIn()) {
        liff.login()
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }, [isLiffReady])


  const getIdToken = useCallback(async (): Promise<string | null> => {
    if (!isLiffReady || !liff.isLoggedIn()) {
      return null
    }

    try {
      return liff.getIDToken()
    } catch (err) {
      console.error('Get ID token error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get ID token')
      return null
    }
  }, [isLiffReady])

  const getUserProfile = useCallback(async () => {
    if (!isLiffReady || !liff.isLoggedIn()) {
      return null
    }

    try {
      return await liff.getProfile()
    } catch (err) {
      console.error('Get user profile error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get user profile')
      return null
    }
  }, [isLiffReady])

  return {
    isLiffReady,
    isLoggedIn,
    isInClient,
    error,
    login,
    getIdToken,
    getUserProfile
  }
}