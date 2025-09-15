'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Gift } from 'lucide-react'
import Link from 'next/link'

export default function AdminRewards() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reward Management</h1>
        <p className="text-gray-600">จัดการรางวัลและของแถมในระบบ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Gift className="mr-2 h-5 w-5" />
            ฟีเจอร์ Reward Management
          </CardTitle>
          <CardDescription>
            หน้านี้จะแสดงการจัดการรางวัลทั้งหมดในระบบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            ฟีเจอร์นี้จะรวมถึง:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
            <li>แสดงรายการรางวัลทั้งหมด</li>
            <li>เพิ่มรางวัลใหม่</li>
            <li>แก้ไขรายละเอียดรางวัล</li>
            <li>อัปโหลดภาพรางวัล</li>
            <li>จัดการสต็อคและความพร้อมใช้งาน</li>
            <li>ลบรางวัล</li>
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