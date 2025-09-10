'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'

export default function DashboardPage() {
  const { user, isLoading, isLiffReady } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    console.log('🔍 Dashboard state:', {
      isLiffReady,
      isLoading,
      hasUser: !!user,
      isOnboarded: user?.is_onboarded,
      userRole: user?.role,
      firstName: user?.first_name
    })
    
    // Redirect to login if not authenticated
    if (isLiffReady && !isLoading && !user) {
      console.log('❌ No user, redirecting to login')
      router.push('/')
      return
    }
    
    // Redirect to onboarding if not completed
    if (user && !user.is_onboarded) {
      console.log('📝 User not onboarded, redirecting to onboarding')
      router.push('/onboarding')
      return
    }
  }, [user, isLoading, isLiffReady, router])

  // Show loading while checking authentication
  if (!isLiffReady || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-[#06c755] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  // Show dashboard if user is fully onboarded
  if (user && user.is_onboarded) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#06c755] rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 8l2 2 4-4"
                    />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Hughome CRM
                </h1>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {user.picture_url && (
                    <img
                      src={user.picture_url}
                      alt="Profile"
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm font-medium text-gray-700">
                    {user.first_name} {user.last_name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Welcome Card */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ยินดีต้อนรับ {user.first_name}! 👋
              </h2>
              <p className="text-gray-600">
                คุณเป็น{user.role === 'contractor' ? 'ผู้รับเหมา' : 'เจ้าของบ้าน'} 
                ในระบบ Hughome CRM
              </p>
            </div>

            {/* Stats Cards */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">ใบเสร็จทั้งหมด</h3>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">แต้มสะสม</h3>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 0v1m-2 0V6a2 2 0 00-2 0v1m2 0V9.5m0 0v3m0-3h.375M12 12l4.905-4.905a2.828 2.828 0 10-4-4L8 8l4 4.001z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">รางวัลที่แลก</h3>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">การดำเนินการด่วน</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="text-sm text-gray-600">อัพโหลดใบเสร็จ</span>
                  </div>
                </button>

                <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 0v1m-2 0V6a2 2 0 00-2 0v1m2 0V9.5m0 0v3m0-3h.375M12 12l4.905-4.905a2.828 2.828 0 10-4-4L8 8l4 4.001z" />
                    </svg>
                    <span className="text-sm text-gray-600">แลกรางวัล</span>
                  </div>
                </button>

                <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-sm text-gray-600">ดูสถิติ</span>
                  </div>
                </button>

                <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm text-gray-600">โปรไฟล์</span>
                  </div>
                </button>

              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow p-6 border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">กิจกรรมล่าสุด</h3>
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">ยังไม่มีกิจกรรม</p>
                <p className="text-sm text-gray-400 mt-1">เริ่มต้นด้วยการอัพโหลดใบเสร็จแรกของคุณ</p>
              </div>
            </div>

          </div>
        </main>
      </div>
    )
  }

  return null
}