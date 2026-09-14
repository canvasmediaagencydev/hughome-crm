'use client'

import { useState, useEffect, memo } from 'react'
import BottomNavigation from '@/components/BottomNavigation'
import { HeaderSection } from '@/components/dashboard/HeaderSection'
import { StatusCard } from '@/components/dashboard/StatusCard'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { useUserSession } from '@/hooks/useUserSession'
import { useUserRefresh } from '@/hooks/useUserRefresh'

function DashboardPage() {
  const [hasInitialRefresh, setHasInitialRefresh] = useState(false)

  // Custom hooks
  const { userData, isLoading, transformUserData } = useUserSession()

  const { isRefreshing, refreshUserData } = useUserRefresh({
    transformUserData,
    onSuccess: () => {
      // userData is managed internally by useUserSession
    },
  })

  // Auto-refresh points on initial load (only once)
  useEffect(() => {
    if (!hasInitialRefresh && userData) {
      setTimeout(() => {
        refreshUserData()
        setHasInitialRefresh(true)
      }, 500)
    }
  }, [hasInitialRefresh, userData, refreshUserData])

  // Loading state
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

  // No user data state
  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-gray-600">ไม่พบข้อมูลผู้ใช้</p>
          <button
            onClick={() => (window.location.href = '/')}
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
      {/* Header Section */}
      <HeaderSection
        firstName={userData.first_name}
        lastName={userData.last_name}
        userRole={userData.role}
      />

      {/* Status Card */}
      <StatusCard
        points={userData.points_balance}
        nextExpiry={userData.next_expiry ?? null}
        isRefreshing={isRefreshing}
        onRefresh={refreshUserData}
      />

      {/* Quick Actions */}
      <QuickActions />

      {/* Points are added automatically from in-store purchases (new flow) */}
      <div className="flex justify-center items-center py-8 px-4">
        <div className="text-center space-y-2">
          <p className="text-gray-600 text-sm font-medium">สะสมคะแนนอัตโนมัติ</p>
          <p className="text-gray-400 text-xs">
            ทุกครั้งที่ซื้อสินค้า คะแนนจะเข้าสู่บัญชีของคุณโดยอัตโนมัติ
          </p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  )
}

export default memo(DashboardPage)
