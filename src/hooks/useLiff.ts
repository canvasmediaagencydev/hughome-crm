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
        
        // For development/desktop: simulate successful LIFF init
        if (typeof window !== 'undefined' && !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
          console.warn('🖥️ Desktop detected - simulating LIFF for development')
          setIsLiffReady(true)
          setIsLoggedIn(true) // Simulate logged in state
          setIsInClient(false)
          return
        }
        
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
    if (!isLiffReady) {
      return null
    }

    // Desktop development mode - return mock token
    if (typeof window !== 'undefined' && !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/)) {
      console.warn('🖥️ Desktop: Using mock ID token for development')
      // Generate a mock JWT token for development
      const mockPayload = {
        sub: 'U714f0fe0fce37946a50d8c8b977168f6', // Mock LINE user ID
        name: 'Desktop User',
        picture: 'https://ui-avatars.com/api/?name=Desktop+User&background=06c755&color=fff&size=100',
        aud: process.env.NEXT_PUBLIC_LINE_LIFF_ID,
        iss: 'https://access.line.me',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
      }
      
      // Simple base64 encoding (not secure, for dev only)
      const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'HS256' }))
      const payload = btoa(JSON.stringify(mockPayload))
      const signature = 'mock-signature-for-development'
      
      return `${header}.${payload}.${signature}`
    }

    if (!liff.isLoggedIn()) {
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