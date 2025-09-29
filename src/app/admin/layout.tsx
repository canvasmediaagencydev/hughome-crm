'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AdminAuthProvider, useAdminAuth } from '@/hooks/useAdminAuth'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import {
  Users,
  Receipt,
  Gift,
  BarChart3,
  LogOut,
  Home,
  X,
  Menu,
  Settings
} from 'lucide-react'
import Link from 'next/link'

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, isAuthenticated } = useAdminAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !isAuthenticated && pathname !== '/admin/login') {
      router.push('/admin/login')
    }
  }, [isAuthenticated, loading, router, pathname])

  const handleLogout = async () => {
    await signOut()
  }

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  const navigation = [
    { name: 'Dashboard', href: '/admin', icon: Home, current: pathname === '/admin' },
    { name: 'จัดการผู้ใช้', href: '/admin/users', icon: Users, current: pathname === '/admin/users' },
    { name: 'ตรวจสอบใบเสร็จ', href: '/admin/receipts', icon: Receipt, current: pathname === '/admin/receipts' },
    { name: 'จัดการรางวัล', href: '/admin/rewards', icon: Gift, current: pathname === '/admin/rewards' },
    { name: 'รายงาน', href: '/admin/reports', icon: BarChart3, current: pathname === '/admin/reports' },
  ]

  return (
    <div className="min-h-screen bg-gray-100 lg:flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:relative lg:transform-none lg:translate-x-0 lg:flex lg:flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-20 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white">
            <div className="flex mx-auto items-center justify-center">
              <h1 className="text-2xl font-bold text-center">Admin Panel</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-white hover:bg-opacity-20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="ml-2 min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-900 truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500">ผู้ดูแลระบบ</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="px-2 py-3 md:py-7 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    item.current
                      ? 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-r-2 border-red-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`mr-3 h-4 w-4 flex-shrink-0 transition-colors ${
                    item.current ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`} />
                  <span className="text-lg">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout Button */}
          <div className="px-2 py-6 mt-40 mx-3">
            <Button
              onClick={handleLogout}
              variant="outline"
              size="lg"
              className="w-full justify-center text-red-700 border-red-300 bg-white hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200"
            >
              <LogOut className="mr-2 h-5 w-5" />
              <span className="text-base">ออกจากระบบ</span>
            </Button>
          </div>

          {/* Bottom spacer */}
          <div className="flex-1"></div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with menu button */}
        <div className="lg:hidden bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-red-800">Admin Panel</h2>
          <Button
            onClick={() => setSidebarOpen(true)}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-50"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminAuthProvider>
      <AdminLayoutContent>
        {children}
      </AdminLayoutContent>
      <Toaster />
    </AdminAuthProvider>
  )
}