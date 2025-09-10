'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'
import { IoMdHome } from "react-icons/io";
import { FaGift } from "react-icons/fa6";
import { FaUser } from "react-icons/fa";

export default function DashboardPage() {
  const { user, isLoading, isLiffReady } = useAuthContext()
  const router = useRouter()
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (isLiffReady && !isLoading && !user) {
      router.push('/')
      return
    }
    
    if (user && !user.is_onboarded) {
      router.push('/onboarding')
      return
    }
  }, [user, isLoading, isLiffReady, router])

  // Reset image error when user changes
  useEffect(() => {
    setImageError(false)
  }, [user?.picture_url])

  // Show loading while checking authentication
  if (!isLiffReady || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  // Show dashboard if user is fully onboarded
  if (user && user.is_onboarded) {
    return (
      <div className="min-h-screen">
        {/* Banner Header */}
        <div className="relative">
          <img 
            src="/image/banner.svg" 
            alt="Hughome Banner"
            className="w-full h-48 object-cover"
          />
        </div>

        {/* Main Content */}
        <div className="px-4 pb-20 rounded-xl -mt-8 relative z-10">
          
          {/* User Profile Section */}
          <div className="flex items-center mb-6">
            <div className="absolute">
              {user.picture_url && !imageError ? (
                <img
                  src={user.picture_url}
                  alt="Profile"
                  className="w-25 h-25 rounded-full border-4 border-white shadow-lg"
                  onError={() => {
                    console.log('🖼️ Image failed to load, showing fallback')
                    setImageError(true)
                  }}
                />
              ) : (
                <div className="w-25 h-25 rounded-full bg-gray-300 flex items-center justify-center text-white text-xl font-bold border-4 border-white shadow-lg">
                  {(user.first_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="ml-24 mt-7 px-4 py-2 ">
              <h2 className="text-lg font-bold text-gray-600">
                {user.first_name} {user.last_name}
              </h2>
              {/* <p className="text-sm text-gray-600">
                {user.role === 'contractor' ? 'ผู้รับเหมา' : 'เจ้าของบ้าน'}
              </p> */}
            </div>
          </div>

          {/* Points Card */}
          <div className="bg-red-600 rounded-2xl p-6 mt-10 mb-6 shadow-lg">
            <div className="flex justify-between items-center px-5">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-white text-2xl font-bold mb-1">User <br /> Point</h3>
                <div className="flex items-baseline">
                  <span className="text-white text-4xl font-bold">
                    {user.points_balance || 0}
                  </span>
                  <span className="text-white text-lg ml-2">แต้ม</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="mb-6 mt-50 mx-auto text-center">
            <button className="w-3/5 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-6 rounded-full shadow-lg transition-colors text-lg">
              อัพโหลดใบเสร็จ
            </button>
            <p className="text-gray-500 text-sm mt-2">คุณสามารถอัพโหลดใบเสร็จเพื่อแลกแต้มได้ที่นี่</p>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
          <div className="flex justify-around items-center">
            
            <button className="flex flex-col items-center py-2 px-3">
              <div className="w-6 h-6 mb-1">
                <IoMdHome className="w-full h-full text-red-500" />
              </div>
              <span className="text-xs text-red-600 font-medium">หน้าหลัก</span>
            </button>

            <button className="flex flex-col items-center py-2 px-3">
              <div className="w-6 h-6 mb-1">
                <FaGift className="w-full h-full text-gray-400" />
              </div>
              <span className="text-xs text-gray-400">แลกของรางวัล</span>
            </button>

            <button className="flex flex-col items-center py-2 px-3">
              <div className="w-6 h-6 mb-1">
                <FaUser className="w-full h-full text-gray-400" />
              </div>
              <span className="text-xs text-gray-400">ข้อมูลผู้ใช้งาน</span>
            </button>

          </div>
        </div>
      </div>
    )
  }

  return null
}