'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useLiff } from '@/hooks/useLiff'
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

export function AuthProvider({ children }: AuthProviderProps) {
  const { isLiffReady, isLoggedIn } = useLiff()
  const auth = useAuth()
  const [hasTriedAutoLogin, setHasTriedAutoLogin] = useState(false)
  const [isAutoLogging, setIsAutoLogging] = useState(false)

  // Auto-login when LIFF is ready and user is logged in
  useEffect(() => {
    if (isLiffReady && isLoggedIn && !hasTriedAutoLogin && !auth.user && !auth.isLoading && !isAutoLogging) {
      console.log('🔄 Auto-login triggered')
      setHasTriedAutoLogin(true)
      setIsAutoLogging(true)
      
      auth.login().finally(() => {
        setIsAutoLogging(false)
      })
    }
  }, [isLiffReady, isLoggedIn, hasTriedAutoLogin, auth.user, auth.isLoading, isAutoLogging, auth.login])

  const contextValue: AuthContextType = {
    ...auth,
    isLiffReady,
    isLoggedIn,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}