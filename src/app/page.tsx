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
    <div className="py-70 flex items-center justify-center">
      <div className="text-center space-y-8">

        {/* Loading Spinner */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
          {/* Outer spinning ring */}
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin duration-1000"></div>
          
          {/* Inner pulsing dot */}
          {/* <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 bg-[#06c755] rounded-full animate-pulse duration-2000"></div>
          </div> */}
        </div>
      </div>
    </div>
  )
}
