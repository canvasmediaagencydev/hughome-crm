'use client'

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import { createClient } from '@/lib/supabase-browser'
import { axiosAdmin } from '@/lib/axios-admin'
import type { User } from '@supabase/supabase-js'
import type { AdminUser, AdminRole, PermissionKey } from '@/types/admin'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'

interface AdminAuthContextType {
  // Auth User (from Supabase Auth)
  user: User | null

  // Admin User (from admin_users table)
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
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  // 1. Handle Supabase Auth Session
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (mounted) {
          if (error) throw error
          setUser(session?.user ?? null)
        }
      } catch (err: any) {
        console.error('[AdminAuth] Session init error:', err)
        if (mounted) setAuthError(err.message)
      } finally {
        if (mounted) setIsAuthLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          setUser(session?.user ?? null)
          setIsAuthLoading(false)
          
          if (event === 'SIGNED_OUT') {
            queryClient.clear() // Clear all cache on logout
            toast.success('ออกจากระบบเรียบร้อยแล้ว')
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, queryClient])

  // 2. Fetch Admin Data using React Query
  const {
    data: adminData,
    isLoading: isAdminLoading,
    error: queryError,
    refetch: refetchAdminData
  } = useQuery({
    queryKey: ['admin-profile', user?.id],
    queryFn: async () => {
      const response = await axiosAdmin.get('/api/admin/me')
      return response.data
    },
    enabled: !!user, // Only fetch if user is logged in
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true, // Auto refresh when coming back to tab
  })

  // 3. Derived State
  const adminUser = adminData?.adminUser ?? null
  const roles = adminData?.roles ?? []
  const permissions = adminData?.permissions ?? []
  const isSuperAdmin = roles.some((role: AdminRole) => role.name === 'super_admin')

  // Combined loading state
  const loading = isAuthLoading || (!!user && isAdminLoading)
  
  // Error handling
  const error = authError || (queryError as Error)?.message || null
  const adminDataError = !!queryError

  // 4. Auth Actions
  const signIn = async (email: string, password: string) => {
    setAuthError(null)
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      setAuthError(result.error.message)
      toast.error(`เข้าสู่ระบบไม่สำเร็จ: ${result.error.message}`)
    }
    return result
  }

  const signUp = async (email: string, password: string) => {
    setAuthError(null)
    const result = await supabase.auth.signUp({ email, password })
    if (result.error) {
      setAuthError(result.error.message)
      toast.error(`สมัครสมาชิกไม่สำเร็จ: ${result.error.message}`)
    } else {
      toast.success('สมัครสมาชิกสำเร็จ')
    }
    return result
  }

  const signOut = async () => {
    setAuthError(null)
    return await supabase.auth.signOut()
  }

  const clearError = () => setAuthError(null)

  const refetch = async () => {
    await refetchAdminData()
  }

  // 5. Permission Helpers
  const hasPermission = useCallback((permission: PermissionKey | string): boolean => {
    return permissions.includes(permission)
  }, [permissions])

  const hasAnyPermission = useCallback((perms: (PermissionKey | string)[]): boolean => {
    return perms.some((p) => permissions.includes(p))
  }, [permissions])

  const hasAllPermissions = useCallback((perms: (PermissionKey | string)[]): boolean => {
    return perms.every((p) => permissions.includes(p))
  }, [permissions])

  const value: AdminAuthContextType = {
    user,
    adminUser,
    roles,
    permissions,
    isSuperAdmin,
    loading,
    error,
    isAuthenticated: !!user && !!adminUser,
    adminDataError,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    signIn,
    signUp,
    signOut,
    clearError,
    refetch,
    getToken: async () => {
      const { data: { session } } = await supabase.auth.getSession()
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
