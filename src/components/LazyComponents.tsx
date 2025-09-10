'use client'

import dynamic from 'next/dynamic'
import { LoadingSpinner } from './LoadingSkeleton'

// Lazy load heavy components with loading states
export const LazyDashboard = dynamic(
  () => import('../app/dashboard/page'),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="กำลังโหลดหน้าแดชบอร์ด..." />
      </div>
    ),
    ssr: true, // Enable SSR for better SEO
  }
)

export const LazyOnboarding = dynamic(
  () => import('../components/OnboardingForm'),
  {
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner message="กำลังเตรียมแบบฟอร์ม..." />
      </div>
    ),
    ssr: true,
  }
)

// Lazy load react-icons to reduce initial bundle size
export const LazyHomeIcon = dynamic(
  () => import('react-icons/io').then(mod => ({ default: mod.IoMdHome })),
  {
    loading: () => <div className="w-6 h-6 bg-gray-200 animate-pulse rounded" />,
    ssr: false, // Icons don't need SSR
  }
)

export const LazyGiftIcon = dynamic(
  () => import('react-icons/fa6').then(mod => ({ default: mod.FaGift })),
  {
    loading: () => <div className="w-6 h-6 bg-gray-200 animate-pulse rounded" />,
    ssr: false,
  }
)

export const LazyUserIcon = dynamic(
  () => import('react-icons/fa').then(mod => ({ default: mod.FaUser })),
  {
    loading: () => <div className="w-6 h-6 bg-gray-200 animate-pulse rounded" />,
    ssr: false,
  }
)