'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Receipt, Gift } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'

export function QuickActions() {
  const { hasPermission } = useAdminAuth()

  const actions = [
    {
      href: '/admin/users',
      label: 'ดูผู้ใช้ทั้งหมด',
      icon: Users,
      show: hasPermission(PERMISSIONS.USERS_VIEW),
    },
    {
      href: '/admin/receipts',
      label: 'ใบเสร็จรอการอนุมัติ',
      icon: Receipt,
      show: hasPermission(PERMISSIONS.RECEIPTS_VIEW),
    },
    {
      href: '/admin/rewards',
      label: 'เพิ่มรางวัลใหม่',
      icon: Gift,
      show: hasPermission(PERMISSIONS.REWARDS_VIEW),
    },
  ].filter((action) => action.show)

  if (actions.length === 0) {
    return null
  }

  const gridColsClass =
    actions.length >= 3 ? 'md:grid-cols-3' : actions.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1'

  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">การดำเนินการด่วน</CardTitle>
        <CardDescription className="text-slate-600">
          ฟีเจอร์ที่ใช้บ่อยสำหรับการจัดการระบบ
        </CardDescription>
      </CardHeader>
      <CardContent className={`grid grid-cols-1 ${gridColsClass} gap-4`}>
        {actions.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Button
              variant="outline"
              className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
