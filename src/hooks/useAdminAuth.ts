'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { User } from '@supabase/supabase-js'
import { toast } from 'sonner'

interface AdminAuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  clearError: () => void
  isAuthenticated: boolean
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseAdmin.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Auth session error:', error)
        setError(error.message)
      }
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabaseAdmin.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email)
        setUser(session?.user ?? null)
        setError(null)

        if (event === 'SIGNED_IN' && session?.user) {
          toast.success('เข้าสู่ระบบสำเร็จ')
        }

        if (event === 'SIGNED_OUT') {
          toast.success('ออกจากระบบเรียบร้อยแล้ว')
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
    }

    setLoading(false)
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

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
    isAuthenticated: !!user && !loading,
  }

  return React.createElement(AdminAuthContext.Provider, { value }, children)
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider")
  return ctx
}