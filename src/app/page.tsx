'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'
import LoginButton from '@/components/LoginButton'

export default function Home() {
  const { user, isLoading, isLiffReady, isLoggedIn } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    // Redirect to onboarding if user is logged in but not onboarded
    if (user && !user.is_onboarded) {
      router.push('/onboarding')
    }
    // Redirect to dashboard if user is fully onboarded
    else if (user && user.is_onboarded) {
      router.push('/dashboard')
    }
  }, [user, router])

  // Show loading while LIFF is initializing
  if (!isLiffReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#06c755] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">กำลังเริ่มต้นระบบ...</p>
        </div>
      </div>
    )
  }

  // Show login screen if not logged in
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          {/* App Logo/Header */}
          <div className="mb-8">
            <div className="w-16 h-16 bg-[#06c755] rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8l2 2 4-4"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Hughome CRM
            </h1>
            <p className="text-gray-600">
              ระบบจัดการลูกค้าสำหรับธุรกิจบริการบ้าน
            </p>
          </div>

          {/* Login Button */}
          <LoginButton />
          
          {/* Features */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-900 mb-4">
              ฟีเจอร์หลัก
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-[#06c755]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                จัดการข้อมูลลูกค้า
              </div>
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-[#06c755]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                ติดตามงานบริการ
              </div>
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-[#06c755]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                รายงานและการวิเคราะห์
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
