'use client'

import { createContext, useContext, useEffect, useState, ReactNode, memo, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLiff } from '@/hooks/useLiff'
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor'
import type { User } from '@/types/user'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  error: string | null
  login: () => Promise<void>
  updateProfile: (data: any) => Promise<void>
  clearError: () => void
  isLiffReady: boolean
  isLoggedIn: boolean
  // Network monitoring
  isOnline: boolean
  connectionQuality: 'fast' | 'slow' | 'offline'
  retryConnection: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = memo(function AuthProvider({ children }: AuthProviderProps) {
  const { isLiffReady, isLoggedIn } = useLiff()
  const auth = useAuth()
  const networkMonitor = useNetworkMonitor()
  const [hasTriedAutoLogin, setHasTriedAutoLogin] = useState(false)
  const [isAutoLogging, setIsAutoLogging] = useState(false)

  // Memoized callback to prevent unnecessary re-renders
  const handleAutoLogin = useCallback(async () => {
    console.log('🔄 Auto-login triggered')
    setHasTriedAutoLogin(true)
    setIsAutoLogging(true)
    
    try {
      await auth.login()
    } finally {
      setIsAutoLogging(false)
    }
  }, [auth.login])

  // Auto-login when LIFF is ready and user is logged in
  useEffect(() => {
    if (isLiffReady && isLoggedIn && !hasTriedAutoLogin && !auth.user && !auth.isLoading && !isAutoLogging) {
      handleAutoLogin()
    }
  }, [isLiffReady, isLoggedIn, hasTriedAutoLogin, auth.user, auth.isLoading, isAutoLogging, handleAutoLogin])

  // Auto-retry login when connection is restored
  useEffect(() => {
    if (networkMonitor.isOnline && networkMonitor.connectionQuality !== 'offline' && auth.error && !auth.isLoading) {
      console.log('🌐 Connection restored, retrying login...')
      
      // Reset auto-login flag to allow retry
      setHasTriedAutoLogin(false)
      
      // Clear previous error
      auth.clearError()
      
      // Small delay to ensure network is stable
      setTimeout(() => {
        if (isLiffReady && isLoggedIn && !auth.user) {
          auth.login().catch((err) => {
            console.warn('Auto-retry login failed:', err)
          })
        }
      }, 1000)
    }
  }, [networkMonitor.isOnline, networkMonitor.connectionQuality, auth.error, auth.isLoading, auth.clearError, auth.login, isLiffReady, isLoggedIn, auth.user])

  // Memoized context value to prevent unnecessary re-renders of children
  const contextValue: AuthContextType = useMemo(() => ({
    ...auth,
    isLiffReady,
    isLoggedIn,
    isOnline: networkMonitor.isOnline,
    connectionQuality: networkMonitor.connectionQuality,
    retryConnection: networkMonitor.retryConnection,
  }), [
    auth,
    isLiffReady,
    isLoggedIn,
    networkMonitor.isOnline,
    networkMonitor.connectionQuality,
    networkMonitor.retryConnection
  ])

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
})