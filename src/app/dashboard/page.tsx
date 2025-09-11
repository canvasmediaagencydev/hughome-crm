'use client'

import { useState, memo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IoMdHome } from "react-icons/io";
import { FaGift } from "react-icons/fa6";
import { FaUser } from "react-icons/fa";
import { IoMdRefresh } from "react-icons/io";
import { UserSessionManager } from '@/lib/user-session'
import axios from 'axios'

// User data interface
interface UserData {
  first_name: string
  last_name: string
  picture_url: string | null
  points_balance: number
  displayName?: string
  pictureUrl?: string
}

const UserProfile = memo(({ user, imageError, onImageError }: {
  user: any
  imageError: boolean
  onImageError: () => void
}) => (
  <div className="flex items-center mb-6">
    <div className="absolute">
      {user.picture_url && !imageError ? (
        <Image
          src={user.picture_url}
          alt="Profile"
          width={100}
          height={100}
          className="w-25 h-25 rounded-full border-4 border-white shadow-lg"
          onError={onImageError}
          priority
        />
      ) : (
        <div className="w-25 h-25 rounded-full bg-red-500 flex items-center justify-center text-white text-xl font-bold border-4 border-white shadow-lg">
          {(user.first_name || 'U').charAt(0).toUpperCase()}
        </div>
      )}
    </div>
    <div className="ml-24 mt-9 px-4 py-2 ">
      <h2 className="text-lg font-bold text-gray-600">
        {user.first_name} {user.last_name}
      </h2>
    </div>
  </div>
))
UserProfile.displayName = 'UserProfile'

const PointsCard = memo(({ points, isRefreshing, onRefresh }: { 
  points: number, 
  isRefreshing?: boolean,
  onRefresh?: () => void 
}) => (
  <div className="relative overflow-hidden">
    {/* Background with gradient */}
    <div className="bg-gradient-to-br from-red-500 via-red-600 to-red-700 rounded-3xl p-6 mt-3 mb-6">
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="absolute top-4 right-4 py-4 px-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-all duration-200 disabled:opacity-50 z-10"
        title="รีเฟรชแต้ม"
      >
        <IoMdRefresh 
          className={`w-8 h-8 ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="w-10 h-10  bg-white/20 rounded-lg flex items-center justify-center mr-3">
            <Image
              src="/image/wired-lineal-290-coin-morph-coins.gif"
              alt="Coins"
              width={32}
              height={32}
              className="w-8 h-8"
            />
          </div>
          <h3 className="text-white/90 text-lg font-medium">คะแนนสะสม</h3>
        </div>

        {/* Points display */}
        <div className="flex items-baseline mb-2">
          <span className="text-white text-5xl font-bold tracking-tight">
            {points?.toLocaleString() || '0'}
          </span>
          <span className="text-white/80 text-xl ml-3 font-medium">แต้ม</span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-end mt-2">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
          <span className="text-white/70 text-sm">
            {isRefreshing ? 'กำลังอัพเดต...' : 'อัพเดตล่าสุด'}
          </span>
        </div>
      </div>
    </div>
  </div>
))
PointsCard.displayName = 'PointsCard'

const UploadButton = memo(() => (
  <div className="mb-6 mx-auto text-center">
    <button className="w-4/5 bg-red-600 text-nowrap hover:bg-red-700 text-white font-medium py-3 px- rounded-full shadow-lg transition-colors text-lg">
      อัพโหลดใบเสร็จ
    </button>
    <p className="text-gray-500 text-sm mt-2">คุณสามารถอัพโหลดใบเสร็จเพื่อแลกแต้มได้ที่นี่</p>
  </div>
))
UploadButton.displayName = 'UploadButton'

const BottomNavigation = memo(() => (
  <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 px-4 py-2 safe-area-pb">
    <div className="flex justify-around items-center pb-3">
      
      <button className="flex flex-col items-center py-2 px-3">
        <div className="w-6 h-6 mb-1">
          <IoMdHome className="w-full h-full text-red-500" />
        </div>
        <span className="text-xs text-red-600 font-medium">หน้าหลัก</span>
      </button>

      <button className="flex flex-col items-center py-2 px-3">
        <div className="w-8 h-8 mb-1">
          <Image
            src="/image/wired-outline-412-gift-morph-open(1).gif"
            alt="Gift"
            width={32}
            height={32}
            className="w-full h-full"
          />
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
))
BottomNavigation.displayName = 'BottomNavigation'

function DashboardPage() {
  const [imageError, setImageError] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const router = useRouter()

  const handleImageError = useCallback(() => {
    setImageError(true)
  }, [])

  const transformUserData = (user: any): UserData => ({
    first_name: user.first_name || user.displayName?.split(' ')[0] || 'User',
    last_name: user.last_name || user.displayName?.split(' ')[1] || '',
    picture_url: user.picture_url || user.pictureUrl,
    points_balance: user.points_balance || 0
  })

  const refreshUserData = useCallback(async () => {
    if (isRefreshing) return
    
    setIsRefreshing(true)
    try {
      const cachedSession = UserSessionManager.getCachedSession()
      if (cachedSession) {
        const response = await axios.post('/api/user/refresh', {
          userId: cachedSession.user.id
        })
        
        if (response.data.success) {
          const updatedUser = { ...cachedSession.user, ...response.data.updates }
          UserSessionManager.updateUserData(updatedUser)
          setUserData(transformUserData(updatedUser))
        }
      }
    } catch (error) {
      console.warn('Failed to refresh user data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing])

  useEffect(() => {
    // Instant loading with cached data
    const cachedUser = UserSessionManager.getCachedUser()
    
    if (cachedUser) {
      // Show cached data immediately
      setUserData(transformUserData(cachedUser))
      setIsLoading(false)
      
      // Always refresh points_balance when user comes back
      setTimeout(() => refreshUserData(), 500)
    } else {
      // Fallback to old localStorage method for backward compatibility
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser)
          const userData = transformUserData(user)
          setUserData(userData)
          // Migrate to new session system
          UserSessionManager.saveSession(user)
          // Also refresh points after showing cached data
          setTimeout(() => refreshUserData(), 500)
        } catch (error) {
          console.error('Error parsing user data:', error)
          router.push('/')
        }
      } else {
        // No user data, redirect to login
        router.push('/')
      }
      setIsLoading(false)
    }
  }, [router]) // Remove refreshUserData from dependencies

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600">ไม่พบข้อมูลผู้ใช้</p>
          <button 
            onClick={() => router.push('/')}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen ">
      {/* Banner Header */}
      <div className="relative">
        <Image
          src="/image/banner.svg" 
          alt="Hughome Banner"
          width={400}
          height={192}
          className="w-full h-48 object-cover"
          priority
        />
      </div>

      {/* Main Content */}
      <div className="px-4 pb-20 justify-between flex flex-col rounded-xl -mt-8 relative z-10">
        <div className='flex flex-col'>
          {/* User Profile Section */}
          <UserProfile
            user={userData}
            imageError={imageError}
            onImageError={handleImageError}
          />

          {/* Points Card */}
          <PointsCard 
            points={userData.points_balance} 
            isRefreshing={isRefreshing} 
            onRefresh={refreshUserData}
          />
         
        </div>
      </div>

      {/* Upload Button fixed above nav */}
      <div className="fixed left-0 right-0 bottom-20 flex justify-center z-30 pointer-events-none">
        <div className="pointer-events-auto w-full flex justify-center">
          <UploadButton />
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}

export default memo(DashboardPage)