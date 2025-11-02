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
  const loadAdminData = async (authUserId: string) => {
    try {
      // Get current session token
      const { data: { session } } = await supabaseAdmin.auth.getSession()
      if (!session?.access_token) {
        setAdminUser(null)
        setRoles([])
        setPermissions([])
        return
      }

      // Call API to get admin data (server-side with service role key)
      const response = await fetch('/api/admin/me', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        setAdminUser(null)
        setRoles([])
        setPermissions([])
        return
      }

      const { adminUser, roles, permissions } = await response.json()

      setAdminUser(adminUser)
      setRoles(roles)
      setPermissions(permissions)
    } catch (err) {
      console.error('Error loading admin data:', err)
      setAdminUser(null)
      setRoles([])
      setPermissions([])
    }
  }

  useEffect(() => {
    supabaseAdmin.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.error('Auth session error:', error)
        setError(error.message)
      }

      const authUser = session?.user ?? null
      setUser(authUser)

      if (authUser) {
        await loadAdminData(authUser.id)
      }

      setLoading(false)
    })

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
          toast.success('ออกจากระบบเรียบร้อยแล้ว')
        } else if (authUser) {
          await loadAdminData(authUser.id)
        }

        setLoading(false)
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