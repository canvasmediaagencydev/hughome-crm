'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminDashboard() {
  const { user, loading, signOut } = useAdminAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/admin/login')
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/admin/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>กำลังโหลด...</div>
      </div>
    )
  }

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Admin Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.email}
              </span>
              <Button
                variant="outline"
                onClick={handleLogout}
              >
                ออกจากระบบ
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Welcome Card */}
            <Card>
              <CardHeader>
                <CardTitle>ยินดีต้อนรับ</CardTitle>
                <CardDescription>
                  ระบบจัดการผู้ดูแล Hughome CRM
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  เข้าสู่ระบบสำเร็จ! คุณสามารถเริ่มจัดการระบบได้แล้ว
                </p>
              </CardContent>
            </Card>

            {/* User Management Card */}
            <Card>
              <CardHeader>
                <CardTitle>จัดการผู้ใช้</CardTitle>
                <CardDescription>
                  ดูและจัดการข้อมูลผู้ใช้งาน
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  เข้าสู่หน้าจัดการผู้ใช้
                </Button>
              </CardContent>
            </Card>

            {/* Receipts Management Card */}
            <Card>
              <CardHeader>
                <CardTitle>อนุมัติใบเสร็จ</CardTitle>
                <CardDescription>
                  ตรวจสอบและอนุมัติใบเสร็จ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  เข้าสู่หน้าอนุมัติใบเสร็จ
                </Button>
              </CardContent>
            </Card>

            {/* Rewards Management Card */}
            <Card>
              <CardHeader>
                <CardTitle>จัดการรางวัล</CardTitle>
                <CardDescription>
                  สร้างและแก้ไขรางวัล
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  เข้าสู่หน้าจัดการรางวัล
                </Button>
              </CardContent>
            </Card>

            {/* Reports Card */}
            <Card>
              <CardHeader>
                <CardTitle>รายงาน</CardTitle>
                <CardDescription>
                  ดูรายงานและสถิติต่างๆ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  เข้าสู่หน้ารายงาน
                </Button>
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>ตั้งค่าระบบ</CardTitle>
                <CardDescription>
                  กำหนดค่าต่างๆ ของระบบ
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  เข้าสู่หน้าตั้งค่า
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}