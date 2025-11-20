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
  const supabase = useMemo(() => createClient(), [])
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminDataError, setAdminDataError] = useState(false)
  const focusRefreshInProgress = useRef(false)

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
  const loadAdminData = useCallback(async (authUserId: string, retryCount = 0) => {
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
            return loadAdminData(authUserId, retryCount + 1)
          }
        }

        // Handle 401/403 from axios error response
        if (fetchErr.response && (fetchErr.response.status === 401 || fetchErr.response.status === 403)) {
          console.warn('Session invalid, signing out')
          await supabase.auth.signOut()
          setAdminUser(null)
          setRoles([])
          setPermissions([])
          return
        }

        if (fetchErr.response && fetchErr.response.status >= 500 && retryCount < maxRetries) {
            console.log(`API error, retrying... (${retryCount + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
            return loadAdminData(authUserId, retryCount + 1)
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

        if (authUser) {
          await loadAdminData(authUser.id)
        }
      } catch (err) {
        console.error('[useAdminAuth] Init auth error:', err)
      } finally {
        console.log('[useAdminAuth] Setting loading to false')
        setLoading(false)
      }
    }

    // Safety timeout - force loading to false after 10 seconds
    const safetyTimeout = setTimeout(() => {
      console.warn('[useAdminAuth] Safety timeout triggered - forcing loading to false')
      setLoading(false)
    }, 10000)

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email)
        const authUser = session?.user ?? null
        setUser(authUser)
        setError(null)

        if (event === 'SIGNED_OUT') {
          setAdminUser(null)
          setRoles([])
          setPermissions([])
          setLoading(false)
          toast.success('ออกจากระบบเรียบร้อยแล้ว')
        } else if (event === 'SIGNED_IN' && authUser) {
          // Only load data on sign in, not on token refresh
          try {
            setLoading(true)
            await loadAdminData(authUser.id)
          } catch (err) {
            console.error('Error loading admin data on sign in:', err)
          } finally {
            setLoading(false)
          }
        }
      }
    )

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [getSessionWithTimeout, isLoginPage, loadAdminData, supabase])

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
  }, [getSessionWithTimeout, isLoginPage, loadAdminData, loading])

  useEffect(() => {
    if (isLoginPage || typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshOnFocus()
      }
    }

    const handleFocus = () => {
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
