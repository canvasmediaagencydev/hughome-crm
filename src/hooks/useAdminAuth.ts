'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react'
import { createClient } from '@/lib/supabase-browser'
import { axiosAdmin } from '@/lib/axios-admin'
import type { User } from '@supabase/supabase-js'
import type { AdminUser, AdminRole, PermissionKey } from '@/types/admin'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface AdminAuthContextType {
  // Auth User (จาก Supabase Auth)
  user: User | null

  // Admin User (จาก admin_users table)
  adminUser: AdminUser | null

  // Roles & Permissions
  roles: AdminRole[]
  permissions: string[]
  isSuperAdmin: boolean

  // Loading & Error States
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  adminDataError: boolean

  // Permission Helpers
  hasPermission: (permission: PermissionKey | string) => boolean
  hasAnyPermission: (permissions: (PermissionKey | string)[]) => boolean
  hasAllPermissions: (permissions: (PermissionKey | string)[]) => boolean

  // Auth Actions
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  clearError: () => void
  refetch: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const userIdRef = React.useRef<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminDataError, setAdminDataError] = useState(false)
  const focusRefreshInProgress = useRef(false)
  const queryClient = useQueryClient()

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries()
  }, [queryClient])

  // Check if we're on login/signup page
  const isLoginPage = typeof window !== 'undefined' &&
    (window.location.pathname === '/admin/login' || window.location.pathname === '/admin/signup')

  const getSessionWithTimeout = useCallback(
    async (timeoutMs = 20000) => {
      let timer: ReturnType<typeof setTimeout> | null = null
      let didTimeout = false

      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            didTimeout = true
            reject(new Error('Session retrieval timeout'))
          }, timeoutMs)
        })

        const sessionResult = (await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise,
        ])) as Awaited<ReturnType<typeof supabase.auth.getSession>>

        return sessionResult
      } catch (err) {
        if (didTimeout) {
          console.warn('[useAdminAuth] Session retrieval timeout, retrying without guard')
          // Retry once without timeout so slow resume doesn't force logout
          return await supabase.auth.getSession()
        }
        throw err
      } finally {
        if (timer) {
          clearTimeout(timer)
        }
      }
    },
    [supabase]
  )

  // ฟังก์ชันโหลดข้อมูล admin, roles, และ permissions
  const loadAdminData = useCallback(async (
    authUserId: string,
    retryCount = 0,
    hasRefreshedSession = false
  ) => {
    const maxRetries = 2
    const timeout = 10000 // 10 seconds timeout

    try {
      setAdminDataError(false)
      // Get current session token
      const { data: { session } } = await getSessionWithTimeout()
      if (!session?.access_token) {
        console.log('[loadAdminData] No session token found')
        setAdminUser(null)
        setRoles([])
        setPermissions([])
        setAdminDataError(true)
        return
      }

      console.log('[loadAdminData] Session found, fetching admin data...')

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        // Call API to get admin data (server-side with service role key)
        // Call API to get admin data (server-side with service role key)
        const response = await axiosAdmin.get('/api/admin/me', {
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Handle unauthorized - session expired or invalid
        const { adminUser, roles, permissions } = response.data
        console.log('[loadAdminData] Admin data fetched successfully', adminUser.email)

        setAdminUser(adminUser)
        setRoles(roles)
        setPermissions(permissions)
        setAdminDataError(false)
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)

        // Handle timeout or network errors
        if (fetchErr.name === 'CanceledError' || fetchErr.code === 'ERR_CANCELED') {
          console.error('Admin data fetch timeout')
          if (retryCount < maxRetries) {
            console.log(`Timeout, retrying... (${retryCount + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
            return loadAdminData(authUserId, retryCount + 1, hasRefreshedSession)
          }
        }

        // Handle 401/403 from axios error response
        if (fetchErr.response && (fetchErr.response.status === 401 || fetchErr.response.status === 403)) {
          console.warn('Session invalid, attempting refresh...')
          if (!hasRefreshedSession) {
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
              console.error('Failed to refresh session:', refreshError.message)
            } else {
              console.log('Session refreshed, retrying admin data load')
              return loadAdminData(authUserId, retryCount, true)
            }
          }

          console.warn('Session invalid after refresh, signing out')
          await supabase.auth.signOut()
          setAdminUser(null)
          setRoles([])
          setPermissions([])
          return
        }

        if (fetchErr.response && fetchErr.response.status >= 500 && retryCount < maxRetries) {
            console.log(`API error, retrying... (${retryCount + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
            return loadAdminData(authUserId, retryCount + 1, hasRefreshedSession)
        }

        setAdminDataError(true)
        throw fetchErr
      }
    } catch (err) {
      console.error('Error loading admin data:', err)
      setAdminUser(null)
      setRoles([])
      setPermissions([])
      setAdminDataError(true)
    }
  }, [getSessionWithTimeout, supabase])

  useEffect(() => {
    // Skip auth init on login/signup pages
    if (isLoginPage) {
      console.log('[useAdminAuth] Skipping auth init on login page')
      setLoading(false)
      return
    }

    const initAuth = async () => {
      try {
        console.log('[useAdminAuth] Starting init auth...')
        const { data: { session }, error } = await getSessionWithTimeout()

        if (error) {
          console.error('[useAdminAuth] Auth session error:', error)
          setError(error.message)
        }

        const authUser = session?.user ?? null
        console.log('[useAdminAuth] Auth user:', authUser?.email)
        setUser(authUser)
        userIdRef.current = authUser?.id || null; // Initialize userIdRef

        if (authUser) {
          await loadAdminData(authUser.id)
          invalidateQueries()
        }
      } catch (err) {
        console.error('[useAdminAuth] Init auth error:', err)
      } finally {
        console.log('[useAdminAuth] Setting loading to false')
        setLoading(false)
      }
    }

    // Safety timeout - force loading to false after 10 seconds
    // Reset on each auth state change to ensure it's always active
    let safetyTimeout: ReturnType<typeof setTimeout> | null = null
    const resetSafetyTimeout = () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout)
      }
      safetyTimeout = setTimeout(() => {
        console.warn('[useAdminAuth] Safety timeout triggered - forcing loading to false')
        setLoading(false)
      }, 10000)
    }

    resetSafetyTimeout()

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email)
        const authUser = session?.user ?? null
        setUser(authUser)
        userIdRef.current = authUser?.id || null; // Update userIdRef on state change
        setError(null)

        // Reset safety timeout on every auth state change
        resetSafetyTimeout()

        if (event === 'SIGNED_OUT') {
          setAdminUser(null)
          setRoles([])
          setPermissions([])
          setLoading(false)
          toast.success('ออกจากระบบเรียบร้อยแล้ว')
        } else if (event === 'SIGNED_IN' && authUser) {
          // Check if it's the same user to avoid blocking UI
          if (userIdRef.current === authUser.id) {
            console.log('[useAdminAuth] Same user SIGNED_IN event, refreshing in background')
            try {
              // Don't set loading=true, just refresh data
              await loadAdminData(authUser.id)
              invalidateQueries()
            } catch (err) {
              console.error('Error refreshing admin data:', err)
            }
          } else {
            console.log('[useAdminAuth] New user SIGNED_IN event, full reload')
            try {
              setLoading(true)
              await loadAdminData(authUser.id)
              invalidateQueries()
            } catch (err) {
              console.error('Error loading admin data on sign in:', err)
            } finally {
              setLoading(false)
            }
          }
        } else if (event === 'TOKEN_REFRESHED') {
          // Token was refreshed (happens when tab regains focus)
          // No need to reload admin data, just ensure loading state is false
          console.log('[useAdminAuth] Token refreshed, ensuring loading state is false')
          setLoading(false)
        } else if (event === 'USER_UPDATED') {
          // User data was updated
          console.log('[useAdminAuth] User updated, ensuring loading state is false')
          setLoading(false)
        } else {
          // Handle any other events (INITIAL_SESSION, PASSWORD_RECOVERY, etc.)
          // Ensure loading state is always resolved
          console.log('[useAdminAuth] Unhandled auth event:', event, '- ensuring loading state is false')
          setLoading(false)
        }
      }
    )

    return () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout)
      }
      subscription.unsubscribe()
    }
  }, [getSessionWithTimeout, invalidateQueries, isLoginPage, loadAdminData, supabase])

  const refreshOnFocus = useCallback(async () => {
    if (focusRefreshInProgress.current || loading || isLoginPage) {
      return
    }

    focusRefreshInProgress.current = true
    try {
      const { data: { session }, error } = await getSessionWithTimeout(6000)

      if (error) {
        console.error('[useAdminAuth] Focus refresh session error:', error.message)
      }

      const authUser = session?.user ?? null
      setUser(authUser)

      if (authUser) {
        await loadAdminData(authUser.id)
        invalidateQueries()
      } else {
        setAdminUser(null)
        setRoles([])
        setPermissions([])
      }
    } catch (err) {
      console.warn('[useAdminAuth] Focus refresh failed:', err)
    } finally {
      focusRefreshInProgress.current = false
    }
  }, [getSessionWithTimeout, invalidateQueries, isLoginPage, loadAdminData, loading])

  useEffect(() => {
    if (isLoginPage || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const handleVisibility = () => {
      console.log('[useAdminAuth] Visibility changed:', document.visibilityState)
      if (document.visibilityState === 'visible') {
        console.log('[useAdminAuth] Tab became visible, refreshing session...')
        refreshOnFocus()
      } else {
        console.log('[useAdminAuth] Tab became hidden')
      }
    }

    const handleFocus = () => {
      console.log('[useAdminAuth] Window gained focus, refreshing session...')
      refreshOnFocus()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isLoginPage, refreshOnFocus])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      toast.error(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`)
      setLoading(false)
    }
    // Don't set loading=false on success - let onAuthStateChange handle it

    return { data, error }
  }

  const signUp = async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      toast.error(`สมัครสมาชิกไม่สำเร็จ: ${error.message}`)
    } else {
      toast.success('สมัครสมาชิกสำเร็จ')
    }

    setLoading(false)
    return { data, error }
  }

  const signOut = async () => {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
    }

    setLoading(false)
    return { error }
  }

  const clearError = () => setError(null)

  const refetch = useCallback(async () => {
    if (user) {
      await loadAdminData(user.id)
    }
  }, [loadAdminData, user])

  // Permission Helpers
  const hasPermission = (permission: PermissionKey | string): boolean => {
    return permissions.includes(permission)
  }

  const hasAnyPermission = (perms: (PermissionKey | string)[]): boolean => {
    return perms.some((p) => permissions.includes(p))
  }

  const hasAllPermissions = (perms: (PermissionKey | string)[]): boolean => {
    return perms.every((p) => permissions.includes(p))
  }

  const isSuperAdmin = roles.some((role) => role.name === 'super_admin')

  const value: AdminAuthContextType = {
    user,
    adminUser,
    roles,
    permissions,
    isSuperAdmin,
    loading,
    error,
    adminDataError,
    isAuthenticated: !!user && !!adminUser && !loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    signIn,
    signUp,
    signOut,
    clearError,
    refetch,
    getToken: async () => {
      const { data: { session } } = await getSessionWithTimeout()
      return session?.access_token ?? null
    }
  }

  return React.createElement(AdminAuthContext.Provider, { value }, children)
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider")
  return ctx
}
