'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function AdminReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-600">ดูรายงานและสถิติการใช้งานระบบ</p>
      </div>

      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center text-slate-900">
            <BarChart3 className="mr-2 h-5 w-5 text-slate-400" />
            ฟีเจอร์ Reports & Analytics
          </CardTitle>
          <CardDescription className="text-slate-600">
            หน้านี้จะแสดงรายงานและการวิเคราะห์ข้อมูลต่างๆ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            ฟีเจอร์นี้จะรวมถึง:
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 mb-4">
            <li>รายงานกิจกรรมผู้ใช้</li>
            <li>สถิติการอัปโหลดใบเสร็จ</li>
            <li>รายงานการแลกรางวัล</li>
            <li>สถิติการใช้งานระบบ</li>
            <li>กราฟและแผนภูมิ</li>
            <li>ส่งออกรายงาน</li>
          </ul>
          <div className="flex space-x-2">
            <Link href="/admin">
              <Button variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">กลับไปหน้า Dashboard</Button>
            </Link>
            <Button disabled className="bg-slate-200 text-slate-500">เร็วๆ นี้</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}