'use client'

import { useState, useEffect, memo } from 'react'
import ReceiptCamera from '@/components/ReceiptCamera'
import ReceiptUploadResult from '@/components/ReceiptUploadResult'
import BottomNavigation from '@/components/BottomNavigation'
import { BannerSlider } from '@/components/dashboard/BannerSlider'
import { StatusCard } from '@/components/dashboard/StatusCard'
import { UploadSection } from '@/components/dashboard/UploadSection'
import { useUserSession } from '@/hooks/useUserSession'
import { useUserRefresh } from '@/hooks/useUserRefresh'
import { useReceiptUpload } from '@/hooks/useReceiptUpload'

function DashboardPage() {
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [hasInitialRefresh, setHasInitialRefresh] = useState(false)

  // Custom hooks
  const { userData, isLoading, transformUserData } = useUserSession()

  const { isRefreshing, refreshUserData } = useUserRefresh({
    transformUserData,
    onSuccess: (updatedData) => {
      // Note: userData is managed internally by useUserSession
      // This callback can be used for side effects if needed
    }
  })

  const {
    isUploadResultOpen,
    isUploadLoading,
    ocrResult,
    uploadError,
    processOCR,
    uploadToDatabase,
    handleRetake,
    handleClose
  } = useReceiptUpload()

  // Auto-refresh points on initial load (only once)
  useEffect(() => {
    if (!hasInitialRefresh && userData) {
      setTimeout(() => {
        refreshUserData()
        setHasInitialRefresh(true)
      }, 500)
    }
  }, [hasInitialRefresh, userData, refreshUserData])

  // Event handlers
  const handleCameraOpen = () => {
    setIsCameraOpen(true)
  }

  const handleCameraClose = () => {
    setIsCameraOpen(false)
  }

  const handleReceiptCapture = async (imageFile: File) => {
    await processOCR(imageFile)
  }

  const handleUploadRetake = () => {
    handleRetake()
    setIsCameraOpen(true)
  }

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
            onClick={() => window.location.href = '/'}
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

      {/* Status Card */}
      <StatusCard
        points={userData.points_balance}
        isRefreshing={isRefreshing}
        onRefresh={refreshUserData}
      />

      {/* Upload Section */}
      <UploadSection onCameraOpen={handleCameraOpen} />

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />

      {/* Receipt Camera */}
      <ReceiptCamera
        isOpen={isCameraOpen}
        onClose={handleCameraClose}
        onCapture={handleReceiptCapture}
      />

      {/* Receipt Upload Result */}
      <ReceiptUploadResult
        isOpen={isUploadResultOpen}
        onClose={handleClose}
        onConfirm={uploadToDatabase}
        onRetake={handleUploadRetake}
        isLoading={isUploadLoading}
        ocrResult={ocrResult}
        error={uploadError}
      />
    </div>
  )
}

export default memo(DashboardPage)
