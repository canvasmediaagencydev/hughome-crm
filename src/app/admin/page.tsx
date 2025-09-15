'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Receipt, Gift, BarChart3, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function AdminDashboard() {
  const { user } = useAdminAuth()
  const dashboardCards = [
    {
      title: 'จัดการผู้ใช้',
      description: 'ดูและจัดการข้อมูลผู้ใช้งาน',
      href: '/admin/users',
      icon: Users,
      stats: 'เร็วๆ นี้',
    },
    {
      title: 'อนุมัติใบเสร็จ',
      description: 'ตรวจสอบและอนุมัติใบเสร็จ',
      href: '/admin/receipts',
      icon: Receipt,
      stats: 'เร็วๆ นี้',
    },
    {
      title: 'จัดการรางวัล',
      description: 'สร้างและแก้ไขรางวัล',
      href: '/admin/rewards',
      icon: Gift,
      stats: 'เร็วๆ นี้',
    },
    {
      title: 'รายงาน',
      description: 'ดูรายงานและสถิติต่างๆ',
      href: '/admin/reports',
      icon: BarChart3,
      stats: 'เร็วๆ นี้',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">ยินดีต้อนรับสู่ระบบจัดการผู้ดูแล Hughome CRM</p>
        <p className="text-sm text-blue-600 mt-2 font-medium">เข้าสู่ระบบด้วย: {user?.email}</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.stats}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
                <Link href={card.href}>
                  <Button className="w-full mt-4" variant="outline" size="sm">
                    เข้าสู่หน้า
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>การดำเนินการด่วน</CardTitle>
          <CardDescription>
            ฟีเจอร์ที่ใช้บ่อยสำหรับการจัดการระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/users">
            <Button variant="outline" className="w-full">
              <Users className="mr-2 h-4 w-4" />
              ดูผู้ใช้ทั้งหมด
            </Button>
          </Link>
          <Link href="/admin/receipts">
            <Button variant="outline" className="w-full">
              <Receipt className="mr-2 h-4 w-4" />
              ใบเสร็จรอการอนุมัติ
            </Button>
          </Link>
          <Link href="/admin/rewards">
            <Button variant="outline" className="w-full">
              <Gift className="mr-2 h-4 w-4" />
              เพิ่มรางวัลใหม่
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}