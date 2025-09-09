'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/AuthProvider'

export default function DashboardPage() {
  const { user, isLoading, isLiffReady } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    // Redirect to login if not authenticated
    if (isLiffReady && !isLoading && !user) {
      router.push('/')
      return
    }
    
    // Redirect to onboarding if not completed
    if (user && !user.is_onboarded) {
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
          {/* Welcome Section */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ยินดีต้อนรับ, {user.first_name}!
            </h2>
            <p className="text-gray-600 mb-4">
              คุณได้เข้าสู่ระบบในฐานะ{' '}
              <span className="font-medium text-[#06c755]">
                {user.role === 'homeowner' ? 'เจ้าของบ้าน' : 'ผู้รับเหมา'}
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">0</div>
                <div className="text-sm text-gray-600">โครงการทั้งหมด</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">0</div>
                <div className="text-sm text-gray-600">โครงการที่ดำเนินการ</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">0</div>
                <div className="text-sm text-gray-600">โครงการที่เสร็จสิ้น</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              เริ่มต้นใช้งาน
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {user.role === 'homeowner' ? (
                <>
                  <button className="bg-[#06c755] hover:bg-[#05b94c] text-white p-4 rounded-lg text-left transition-colors">
                    <h4 className="font-medium mb-1">สร้างโครงการใหม่</h4>
                    <p className="text-sm opacity-90">เพิ่มงานบ้านที่ต้องการให้ซ่อมแซม</p>
                  </button>
                  <button className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg text-left transition-colors">
                    <h4 className="font-medium mb-1">หาผู้รับเหมา</h4>
                    <p className="text-sm opacity-90">ค้นหาผู้รับเหมาที่เหมาะสม</p>
                  </button>
                  <button className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg text-left transition-colors">
                    <h4 className="font-medium mb-1">ดูประวัติงาน</h4>
                    <p className="text-sm opacity-90">ตรวจสอบงานที่ผ่านมา</p>
                  </button>
                </>
              ) : (
                <>
                  <button className="bg-[#06c755] hover:bg-[#05b94c] text-white p-4 rounded-lg text-left transition-colors">
                    <h4 className="font-medium mb-1">ค้นหางาน</h4>
                    <p className="text-sm opacity-90">หางานใหม่ที่เหมาะกับคุณ</p>
                  </button>
                  <button className="bg-blue-500 hover:bg-blue-600 text-white p-4 rounded-lg text-left transition-colors">
                    <h4 className="font-medium mb-1">จัดการงาน</h4>
                    <p className="text-sm opacity-90">อัปเดตสถานะงานของคุณ</p>
                  </button>
                  <button className="bg-purple-500 hover:bg-purple-600 text-white p-4 rounded-lg text-left transition-colors">
                    <h4 className="font-medium mb-1">รายงานรายได้</h4>
                    <p className="text-sm opacity-90">ดูสรุปรายได้</p>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Coming Soon Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              กำลังพัฒนา
            </h3>
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                ฟีเจอร์เพิ่มเติม
              </h4>
              <p className="text-gray-600 max-w-md mx-auto">
                เรากำลังพัฒนาฟีเจอร์ใหม่ ๆ เพื่อให้การใช้งานสะดวกยิ่งขึ้น 
                โปรดติดตามอัปเดตต่อไป
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return null
}