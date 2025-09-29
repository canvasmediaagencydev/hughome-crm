'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Receipt, Gift, BarChart3, Settings, Save } from 'lucide-react'
import Link from 'next/link'
import { Tables } from '../../../database.types'
import { toast } from 'sonner'

type PointSetting = Tables<'point_settings'>

export default function AdminDashboard() {
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [bahtPerPoint, setBahtPerPoint] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPointSetting()
  }, [])

  const fetchPointSetting = async () => {
    try {
      const response = await fetch('/api/admin/point-settings')
      if (response.ok) {
        const data = await response.json()
        const bahtSetting = data.find((s: PointSetting) => s.setting_key === 'baht_per_point')
        if (bahtSetting) {
          setPointSetting(bahtSetting)
          setBahtPerPoint(bahtSetting.setting_value.toString())
        }
      }
    } catch (error) {
      console.error('Failed to fetch point setting:', error)
    } finally {
      setLoading(false)
    }
  }

  const savePointSetting = async () => {
    setSaving(true)
    try {
      const value = parseFloat(bahtPerPoint)
      if (isNaN(value) || value <= 0) {
        toast.error('กรุณาใส่ตัวเลขที่ถูกต้อง')
        return
      }

      const url = '/api/admin/point-settings'
      const method = pointSetting ? 'PUT' : 'POST'
      const body = pointSetting
        ? { id: pointSetting.id, setting_value: value }
        : {
            setting_key: 'baht_per_point',
            setting_value: value,
            description: 'Amount in Thai Baht required to earn 1 point',
            is_active: true
          }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        await fetchPointSetting()
        toast.success('บันทึกสำเร็จ!')
      }
    } catch (error) {
      console.error('Failed to save point setting:', error)
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
    }
  }
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
        <h1 className="text-3xl font-bold text-red-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">ยินดีต้อนรับสู่ระบบจัดการผู้ดูแล Hughome CRM</p>
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
                <Icon className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.stats}</div>
                <p className="text-xs text-muted-foreground">
                  {card.description}
                </p>
                <Link href={card.href}>
                  <Button className="w-full mt-4 border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600" variant="outline" size="sm">
                    เข้าสู่หน้า
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Point Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-800 flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            ตั้งค่าอัตราแลกเปลี่ยน Point
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-gray-500">กำลังโหลด...</p>
          ) : (
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <Label htmlFor="bahtPerPoint">จำนวนบาทต่อ 1 Point</Label>
                <Input
                  id="bahtPerPoint"
                  type="number"
                  step="0.01"
                  value={bahtPerPoint}
                  onChange={(e) => setBahtPerPoint(e.target.value)}
                  placeholder="100.00"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ตัวอย่าง: ใส่ 100 หมายถึง ใช้เงิน 100 บาท ได้ 1 Point
                </p>
              </div>
              <Button
                onClick={savePointSetting}
                disabled={saving}
                className="bg-red-600 hover:bg-red-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-red-800">การดำเนินการด่วน</CardTitle>
          <CardDescription>
            ฟีเจอร์ที่ใช้บ่อยสำหรับการจัดการระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/users">
            <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600">
              <Users className="mr-2 h-4 w-4" />
              ดูผู้ใช้ทั้งหมด
            </Button>
          </Link>
          <Link href="/admin/receipts">
            <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600">
              <Receipt className="mr-2 h-4 w-4" />
              ใบเสร็จรอการอนุมัติ
            </Button>
          </Link>
          <Link href="/admin/rewards">
            <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-600 hover:text-white hover:border-red-600">
              <Gift className="mr-2 h-4 w-4" />
              เพิ่มรางวัลใหม่
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
