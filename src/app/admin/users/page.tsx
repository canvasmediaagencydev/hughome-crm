'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import Link from 'next/link'

export default function AdminUsers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600">จัดการข้อมูลผู้ใช้งานในระบบ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            ฟีเจอร์ User Management
          </CardTitle>
          <CardDescription>
            หน้านี้จะแสดงรายการผู้ใช้ทั้งหมดและฟีเจอร์การจัดการ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            ฟีเจอร์นี้จะรวมถึง:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
            <li>แสดงรายการผู้ใช้ทั้งหมด</li>
            <li>ค้นหาและกรองผู้ใช้</li>
            <li>ดูรายละเอียดผู้ใช้</li>
            <li>ล็อค/ปลดล็อคบัญชีผู้ใช้</li>
            <li>ดูประวัติการทำธุรกรรม</li>
          </ul>
          <div className="flex space-x-2">
            <Link href="/admin">
              <Button variant="outline">กลับไปหน้า Dashboard</Button>
            </Link>
            <Button disabled>เร็วๆ นี้</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}