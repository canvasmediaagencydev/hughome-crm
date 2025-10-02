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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-4"></div>
          <p className="text-slate-600">กำลังโหลด...</p>
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
    { name: 'คำขอแลกของรางวัล', href: '/admin/redemptions', icon: BarChart3, current: pathname === '/admin/redemptions' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div className={`fixed inset-y-0 left-0 z-50 h-full w-64 bg-slate-900 shadow-xl transform transition-transform duration-300 ease-in-out lg:static lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
            <div className="flex mx-auto items-center justify-center">
              <h1 className="text-lg font-semibold text-white tracking-tight">Admin Panel</h1>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-md hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-4 border-b border-slate-800">
            <div className="flex items-center">
              <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-slate-200 font-medium text-sm ring-2 ring-slate-600">
                {user?.email?.[0]?.toUpperCase() || 'A'}
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200 truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-slate-400">ผู้ดูแลระบบ</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    item.current
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className={`mr-3 h-5 w-5 flex-shrink-0 transition-colors ${
                    item.current ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-300'
                  }`} />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-slate-800">
            <Button
              onClick={handleLogout}
              variant="outline"
              size="default"
              className="w-full justify-center text-slate-300 border-slate-700 bg-slate-800 hover:bg-slate-700 hover:text-white hover:border-slate-600 transition-all duration-200"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="text-sm">ออกจากระบบ</span>
            </Button>
          </div>
        </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with menu button */}
        <div className="lg:hidden bg-white shadow-sm border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Admin Panel</h2>
          <Button
            onClick={() => setSidebarOpen(true)}
            variant="outline"
            size="sm"
            className="border-slate-200 text-slate-700 hover:bg-slate-100"
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
