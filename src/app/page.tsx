'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  userId: string
  displayName: string
  pictureUrl: string
  statusMessage?: string
}

declare global {
  interface Window {
    liff: {
      init: (config: { liffId: string }) => Promise<void>
      isLoggedIn: () => boolean
      getProfile: () => Promise<User>
      getIDToken: () => string
      login: () => void
      logout: () => void
    }
  }
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const logOut = () => {
    window.liff.logout()
    window.location.reload()
  }

  const main = async () => {
    try {
      await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })
      
      if (window.liff.isLoggedIn()) {
        const profile = await window.liff.getProfile()
        
        // Call our API to authenticate with backend
        try {
          const idToken = window.liff.getIDToken()
          const response = await fetch('/api/liff/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken })
          })
          
          const data = await response.json()
          if (data.success && data.user) {
            // Store user data in localStorage for dashboard
            localStorage.setItem('user', JSON.stringify({
              ...profile,
              ...data.user
            }))
            
            // Check if user needs onboarding
            if (!data.user.is_onboarded) {
              router.push('/onboarding')
            } else {
              router.push('/dashboard')
            }
          } else {
            setUser(profile) // Fallback to show LINE profile
          }
        } catch (apiError) {
          console.error('API authentication failed:', apiError)
          setUser(profile) // Fallback to show LINE profile
        }
      } else {
        window.liff.login()
      }
    } catch (error) {
      console.error('LIFF initialization error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && window.liff) {
      main()
    } else {
      // Wait for LIFF SDK to load
      const script = document.createElement('script')
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
      script.onload = () => main()
      document.head.appendChild(script)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="py-70 flex items-center justify-center">
        <div className="text-center space-y-8">
          <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-red-500 animate-spin duration-1000"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="py-70 flex items-center justify-center">
        <div className="text-center space-y-8">
          <p>กำลังเข้าสู่ระบบ...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <img 
            width={100} 
            height={100}
            className="mx-auto rounded-full mb-4"
            src={user.pictureUrl} 
            alt="Profile"
          />
          <div className="mb-2">
            สวัสดี <strong>{user.displayName}</strong>
          </div>
          <div className="text-gray-600 mb-4">
            UID: {user.userId}
          </div>
          <button 
            onClick={logOut}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  )
}