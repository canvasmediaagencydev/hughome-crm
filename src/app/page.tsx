'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'

export default function Home() {
  const { user, isLoading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (user && !isLoading) {
      if (!user.is_onboarded) {
        router.replace('/onboarding')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [user, router, isLoading])

  // Show clean loading spinner while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center space-y-8">
        {/* Brand Logo/Title */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Hughome
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            ระบบสะสมแต้ม
          </p>
        </div>

        {/* Loading Spinner */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#06c755] animate-spin duration-1000"></div>
          
          {/* Inner pulsing dot */}
          {/* <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-[#06c755] rounded-full animate-pulse duration-2000"></div>
          </div> */}
        </div>

        {/* Loading Text */}
        <div className="space-y-4">
          <p className="text-gray-700 font-medium text-sm sm:text-base">
            กำลังเข้าสู่ระบบ...
          </p>
          
          {/* Bouncing dots */}
          {/* <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce [animation-delay:0ms]"></div>
            <div className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce [animation-delay:150ms]"></div>
            <div className="w-2 h-2 bg-[#06c755] rounded-full animate-bounce [animation-delay:300ms]"></div>
          </div> */}
        </div>

        {/* Progress bar */}
        {/* <div className="w-32 sm:w-40 mx-auto">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#06c755] to-[#00b94a] rounded-full animate-pulse duration-1500"></div>
          </div>
        </div> */}
      </div>
    </div>
  )
}
