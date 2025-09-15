'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'
import Link from 'next/link'

export default function AdminReceipts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Receipt Review</h1>
        <p className="text-gray-600">ตรวจสอบและอนุมัติใบเสร็จที่ผู้ใช้อัปโหลด</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Receipt className="mr-2 h-5 w-5" />
            ฟีเจอร์ Receipt Review
          </CardTitle>
          <CardDescription>
            หน้านี้จะแสดงใบเสร็จที่รอการอนุมัติและระบบตรวจสอบ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            ฟีเจอร์นี้จะรวมถึง:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
            <li>แสดงใบเสร็จรอการอนุมัติ</li>
            <li>ดูรายละเอียดใบเสร็จและภาพ</li>
            <li>ตรวจสอบข้อมูล OCR</li>
            <li>อนุมัติ/ปฏิเสธใบเสร็จ</li>
            <li>คำนวณและให้คะแนน</li>
            <li>เพิ่มหมายเหตุ</li>
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