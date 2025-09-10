'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import liff from '@line/liff'
import axios from 'axios'

interface User {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}


export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const main = async () => {
    try {
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })
      
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile()
        
        // Call our API to authenticate with backend
        try {
          const idToken = liff.getIDToken()
          const response = await axios.post('/api/liff/login', {
            idToken
          })
          
          const data = response.data
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
        liff.login()
      }
    } catch (error) {
      console.error('LIFF initialization error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      main()
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
}