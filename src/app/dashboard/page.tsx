'use client'

import { useState, memo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { IoMdHome, IoMdRefresh, IoMdTrendingUp, IoMdCamera } from "react-icons/io";
import { FaUser, FaHistory, FaWallet, FaStar } from "react-icons/fa";
import { HiOutlineUpload, HiOutlineGift, HiOutlineBell, HiOutlineMenu } from "react-icons/hi";
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

const BannerSlider = memo(() => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slideInterval = useRef<NodeJS.Timeout | null>(null)

  // Mock multiple banners - ในอนาคตจะ fetch จาก API
  const banners = [
    '/image/banner.svg',
    '/image/banner.svg', // ใช้ไฟล์เดียวก่อน
    '/image/banner.svg',
  ]

  const startSlideShow = useCallback(() => {
    slideInterval.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length)
    }, 4000) // เปลี่ยนทุก 4 วินาที
  }, [banners.length])

  const stopSlideShow = useCallback(() => {
    if (slideInterval.current) {
      clearInterval(slideInterval.current)
      slideInterval.current = null
    }
  }, [])

  useEffect(() => {
    startSlideShow()
    return () => stopSlideShow()
  }, [startSlideShow, stopSlideShow])

  return (
    <div className="relative h-48 overflow-hidden">
      <div
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {banners.map((banner, index) => (
          <div key={index} className="w-full flex-shrink-0 h-full relative">
            <Image
              src={banner}
              alt={`Banner ${index + 1}`}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-200 ${index === currentSlide ? 'bg-white' : 'bg-white/50'
              }`}
          />
        ))}
      </div>
    </div>
  )
})

const HeaderSection = memo(({ user, imageError, onImageError }: {
  user: any
  imageError: boolean
  onImageError: () => void
}) => (
  <div className="bg-white shadow-xs rounded-b-2xl">
    <div className="flex items-center justify-between p-4 px-6">
      <div className="flex items-center space-x-4">
        <div className="relative">
          {user.picture_url && !imageError ? (
            <Image
              src={user.picture_url}
              alt="Profile"
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100"
              onError={onImageError}
              priority
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white text-lg font-semibold shadow-lg">
              {(user.first_name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-gray-900 text-lg font-semibold leading-tight">
            {user.first_name} {user.last_name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">ยินดีต้อนรับกลับมา</p>
        </div>
      </div>
    </div>
  </div>
))
HeaderSection.displayName = 'HeaderSection'

const StatusCard = memo(({ points, isRefreshing, onRefresh }: {
  points: number,
  isRefreshing?: boolean,
  onRefresh?: () => void
}) => (
  <div className=" mt-5 mx-4 mb-4">
    <div className="bg-gray-900 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-green-500 text-xs font-medium uppercase tracking-wide">ACTIVE</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="text-gray-400 hover:text-white"
        >
          <IoMdRefresh className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="text-white mb-4">
        <h3 className="text-lg font-medium mb-1">คะแนนสะสม</h3>
        <p className="text-sm text-gray-400">Total Points</p>
      </div>

      <div className="mb-4">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full"
            style={{ width: `${Math.min((points / 500000) * 100, 100)}%` }}
          ></div>
        </div>
      </div>

      <div className="flex justify-between text-sm">
        <div>
          <span className="text-gray-400">ยอดรวม</span>
          <div className="text-white font-medium text-xl">{points?.toLocaleString() || '0'} แต้ม</div>
        </div>
        <div className="text-right">
          <div className="text-white font-medium text-xs">
            <span className="text-gray-400">สถานะ</span>
            <div className="text-white font-medium">{isRefreshing ? 'อัพเดต...' : 'ล่าสุด'}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
))
StatusCard.displayName = 'StatusCard'


const UploadSection = memo(() => (
  <div className="bg-gray-50 px-6 pb-24">
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-sm text-gray-600">ถ่ายรูปหรือเลือกรูปใบเสร็จเพื่อสะสมแต้ม</p>
      </div>

      <button className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]">
        <div className="bg-white/20 p-2 rounded-full">
          <IoMdCamera className="w-6 h-6" />
        </div>
        <span className="text-lg">อัพโหลดใบเสร็จ</span>
      </button>

      {/* <div className="grid grid-cols-2 gap-3 mt-4">
        <button className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-md">
          <FaHistory className="w-4 h-4 text-gray-500" />
          <span className="text-sm">ประวัติการอัพโหลด</span>
        </button>

        <button className="bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 hover:shadow-md">
          <HiOutlineGift className="w-4 h-4 text-gray-500" />
          <span className="text-sm">ดูรางวัล</span>
        </button>
      </div> */}
    </div>
  </div>
))

const BottomNavigation = memo(() => (
  <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-gray-100 shadow-2xl backdrop-blur-lg">
    <div className="flex justify-around items-center py-2 px-4 safe-area-pb">

      <button className="flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-red-50 active:scale-95">
        <div className="w-6 h-6 mb-1 relative">
          <IoMdHome className="w-full h-full text-red-500" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
        <span className="text-xs text-red-600 font-semibold">หน้าหลัก</span>
      </button>

      <button className="flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-gray-50 active:scale-95">
        <div className="w-6 h-6 mb-1">
          <HiOutlineGift className="w-full h-full text-gray-500" />
        </div>
        <span className="text-xs text-gray-500 font-medium">รางวัล</span>
      </button>

      <button className="flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-gray-50 active:scale-95">
        <div className="w-6 h-6 mb-1">
          <FaHistory className="w-full h-full text-gray-500" />
        </div>
        <span className="text-xs text-gray-500 font-medium">ประวัติ</span>
      </button>

      <button className="flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-gray-50 active:scale-95">
        <div className="w-6 h-6 mb-1">
          <FaUser className="w-full h-full text-gray-500" />
        </div>
        <span className="text-xs text-gray-500 font-medium">โปรไฟล์</span>
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
  const [hasInitialRefresh, setHasInitialRefresh] = useState(false)
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

          // Check if user needs to complete onboarding after refresh
          if (!updatedUser.is_onboarded) {
            router.push('/onboarding')
            return
          }
        }
      }
    } catch (error: any) {
      console.warn('Failed to refresh user data:', error)

      // If user not found in database (404), logout and redirect to login
      if (error.response?.status === 404) {
        console.log('User not found in database, logging out and redirecting to login')
        UserSessionManager.clearSession()

        // Logout from LINE LIFF and redirect to login page
        try {
          const liff = (await import('@line/liff')).default
          await liff.init({ liffId: process.env.NEXT_PUBLIC_LINE_LIFF_ID || "2000719050-rGVOBePm" })
          if (liff.isLoggedIn()) {
            liff.logout()
          }
        } catch (liffError) {
          console.warn('LIFF logout failed:', liffError)
        }

        router.push('/')
        return
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, router])

  useEffect(() => {
    // Only run initial load logic once
    if (hasInitialRefresh) return

    // Instant loading with cached data
    const cachedUser = UserSessionManager.getCachedUser()

    if (cachedUser) {
      // Show cached data immediately
      setUserData(transformUserData(cachedUser))
      setIsLoading(false)

      // Always refresh points_balance when user comes back (only once)
      setTimeout(() => {
        refreshUserData()
        setHasInitialRefresh(true)
      }, 500)
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
          // Also refresh points after showing cached data (only once)
          setTimeout(() => {
            refreshUserData()
            setHasInitialRefresh(true)
          }, 500)
        } catch (error) {
          console.error('Error parsing user data:', error)
          router.push('/')
        }
      } else {
        // No user data, redirect to login
        router.push('/')
      }
      setIsLoading(false)
      setHasInitialRefresh(true)
    }
  }, [hasInitialRefresh, refreshUserData, router])

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
    <div className="min-h-screen bg-gray-50">
      {/* Banner Slider */}
      <BannerSlider />

      {/* Header */}
      <HeaderSection
        user={userData}
        imageError={imageError}
        onImageError={handleImageError}
      />

      {/* Status Card */}
      <StatusCard
        points={userData.points_balance}
        isRefreshing={isRefreshing}
        onRefresh={refreshUserData}
      />

      {/* Upload Section */}
      <UploadSection />

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}

export default memo(DashboardPage)