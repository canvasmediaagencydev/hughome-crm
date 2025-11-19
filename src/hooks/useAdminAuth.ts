'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
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
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ฟังก์ชันโหลดข้อมูล admin, roles, และ permissions
  const loadAdminData = async (authUserId: string, retryCount = 0) => {
    const maxRetries = 2
    const timeout = 10000 // 10 seconds timeout

    try {
      // Get current session token
      const { data: { session } } = await supabaseAdmin.auth.getSession()
      if (!session?.access_token) {
        setAdminUser(null)
        setRoles([])
        setPermissions([])
        return
      }

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        // Call API to get admin data (server-side with service role key)
        const response = await fetch('/api/admin/me', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        // Handle unauthorized - session expired or invalid
        if (response.status === 401 || response.status === 403) {
          console.warn('Session invalid, signing out')
          await supabaseAdmin.auth.signOut()
          setAdminUser(null)
          setRoles([])
          setPermissions([])
          return
        }

        if (!response.ok) {
          // Retry on 500 errors
          if (response.status >= 500 && retryCount < maxRetries) {
            console.log(`API error, retrying... (${retryCount + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
            return loadAdminData(authUserId, retryCount + 1)
          }

          setAdminUser(null)
          setRoles([])
          setPermissions([])
          return
        }

        const { adminUser, roles, permissions } = await response.json()

        setAdminUser(adminUser)
        setRoles(roles)
        setPermissions(permissions)
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)

        // Handle timeout or network errors
        if (fetchErr.name === 'AbortError') {
          console.error('Admin data fetch timeout')
          if (retryCount < maxRetries) {
            console.log(`Timeout, retrying... (${retryCount + 1}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)))
            return loadAdminData(authUserId, retryCount + 1)
          }
        }

        throw fetchErr
      }
    } catch (err) {
      console.error('Error loading admin data:', err)
      setAdminUser(null)
      setRoles([])
      setPermissions([])
    }
  }

  useEffect(() => {
    const initAuth = async () => {
      try {
        console.log('[useAdminAuth] Starting init auth...')
        const { data: { session }, error } = await supabaseAdmin.auth.getSession()

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

    return () => clearTimeout(safetyTimeout)

    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(
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

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
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

    const { data, error } = await supabaseAdmin.auth.signUp({
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

    const { error } = await supabaseAdmin.auth.signOut()

    if (error) {
      setError(error.message)
    }

    setLoading(false)
    return { error }
  }

  const clearError = () => setError(null)

  const refetch = async () => {
    if (user) {
      await loadAdminData(user.id)
    }
  }

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
    isAuthenticated: !!user && !!adminUser && !loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    signIn,
    signUp,
    signOut,
    clearError,
    refetch,
  }

  return React.createElement(AdminAuthContext.Provider, { value }, children)
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider")
  return ctx
}