'use client'

import { memo } from 'react'

// Reusable skeleton components for better loading states and CLS prevention
export const SkeletonBox = memo(({ 
  className, 
  animate = true 
}: { 
  className?: string
  animate?: boolean 
}) => (
  <div 
    className={`bg-gray-200 rounded ${animate ? 'animate-pulse' : ''} ${className || ''}`}
    aria-hidden="true"
  />
))
SkeletonBox.displayName = 'SkeletonBox'

export const DashboardSkeleton = memo(() => (
  <div className="min-h-screen" aria-label="Loading dashboard">
    {/* Banner Skeleton */}
    <div className="relative">
      <SkeletonBox className="w-full h-48" />
    </div>

    {/* Main Content */}
    <div className="px-4 pb-20 rounded-xl -mt-8 relative z-10">
      
      {/* User Profile Skeleton */}
      <div className="flex items-center mb-6">
        <div className="absolute">
          <SkeletonBox className="w-25 h-25 rounded-full border-4 border-white shadow-lg" />
        </div>
        <div className="ml-24 mt-7 px-4 py-2">
          <SkeletonBox className="h-5 w-32 mb-2" />
          <SkeletonBox className="h-4 w-24" />
        </div>
      </div>

      {/* Points Card Skeleton */}
      <div className="bg-gray-300 rounded-2xl p-6 mt-10 mb-6 shadow-lg animate-pulse">
        <div className="flex justify-between items-center px-5">
          <div className="flex items-center justify-between w-full">
            <SkeletonBox className="h-8 w-20 bg-gray-400" animate={false} />
            <div className="flex items-baseline">
              <SkeletonBox className="h-12 w-16 bg-gray-400" animate={false} />
              <SkeletonBox className="h-6 w-8 ml-2 bg-gray-400" animate={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Button Skeleton */}
      <div className="mb-6 mt-50 mx-auto text-center">
        <SkeletonBox className="h-12 w-3/5 mx-auto rounded-full" />
        <SkeletonBox className="h-4 w-4/5 mx-auto mt-2" />
      </div>
    </div>

    {/* Bottom Navigation Skeleton */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
      <div className="flex justify-around items-center">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center py-2 px-3">
            <SkeletonBox className="w-6 h-6 mb-1" />
            <SkeletonBox className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  </div>
))
DashboardSkeleton.displayName = 'DashboardSkeleton'

export const ProfileImageSkeleton = memo(() => (
  <SkeletonBox className="w-25 h-25 rounded-full border-4 border-white shadow-lg" />
))
ProfileImageSkeleton.displayName = 'ProfileImageSkeleton'

export const CardSkeleton = memo(({ className }: { className?: string }) => (
  <div className={`bg-gray-200 rounded-2xl p-6 shadow-lg animate-pulse ${className || ''}`}>
    <div className="space-y-3">
      <SkeletonBox className="h-4 w-3/4" animate={false} />
      <SkeletonBox className="h-4 w-1/2" animate={false} />
      <SkeletonBox className="h-6 w-full" animate={false} />
    </div>
  </div>
))
CardSkeleton.displayName = 'CardSkeleton'

// Generic loading spinner with better accessibility
export const LoadingSpinner = memo(({ 
  size = 'medium', 
  color = 'red',
  message = 'กำลังโหลด...' 
}: {
  size?: 'small' | 'medium' | 'large'
  color?: 'red' | 'blue' | 'gray'
  message?: string
}) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-16 h-16',
    large: 'w-24 h-24'
  }
  
  const colorClasses = {
    red: 'border-red-500',
    blue: 'border-blue-500',
    gray: 'border-gray-500'
  }
  
  return (
    <div className="flex items-center justify-center" role="status" aria-live="polite">
      <div className="text-center space-y-4">
        <div 
          className={`${sizeClasses[size]} border-4 ${colorClasses[color]} border-t-transparent rounded-full animate-spin mx-auto`}
          aria-hidden="true"
        />
        <p className="text-gray-600" aria-label={`Loading: ${message}`}>
          {message}
        </p>
      </div>
    </div>
  )
})
LoadingSpinner.displayName = 'LoadingSpinner'