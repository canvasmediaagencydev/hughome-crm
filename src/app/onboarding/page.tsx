'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'
import OnboardingForm from '@/components/OnboardingForm'

export default function OnboardingPage() {
  const { user, isLoading, isLiffReady } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (isLiffReady && !isLoading && !user) {
      router.push('/')
      return
    }
    
    // Redirect to dashboard if already onboarded
    if (user && user.is_onboarded) {
      router.push('/dashboard')
      return
    }
  }, [user, isLoading, isLiffReady, router])

  // Show loading while checking authentication
  if (!isLiffReady || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#06c755] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">กำลังตรวจสอบข้อมูล...</p>
        </div>
      </div>
    )
  }

  // Show onboarding form if user exists but not onboarded
  if (user && !user.is_onboarded) {
    return <OnboardingForm />
  }

  return null
}