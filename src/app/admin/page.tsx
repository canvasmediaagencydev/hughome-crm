'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Receipt, Gift, BarChart3, Settings, Save, Zap } from 'lucide-react'
import Link from 'next/link'
import { Tables } from '../../../database.types'
import { toast } from 'sonner'

type PointSetting = Tables<'point_settings'>

export default function AdminDashboard() {
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [bahtPerPoint, setBahtPerPoint] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recentReceipts, setRecentReceipts] = useState<any[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(true)
  const [autoApproving, setAutoApproving] = useState(false)

  useEffect(() => {
    fetchPointSetting()
    fetchRecentReceipts()
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

  const fetchRecentReceipts = async () => {
    setReceiptsLoading(true)
    try {
      const response = await fetch('/api/admin/receipts?limit=10&status=pending')
      if (response.ok) {
        const data = await response.json()
        setRecentReceipts(data.receipts || [])
      }
    } catch (error) {
      console.error('Failed to fetch recent receipts:', error)
    } finally {
      setReceiptsLoading(false)
    }
  }

  const calculatePoints = (totalAmount: number): number => {
    if (!pointSetting || !totalAmount) return 0
    return Math.floor(totalAmount / pointSetting.setting_value)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800'
    }

    const labels = {
      pending: 'รอการอนุมัติ',
      approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธแล้ว',
      processing: 'กำลังประมวลผล'
    }

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    )
  }

  const handleAutoApprove = async () => {
    if (!confirm('คุณต้องการอนุมัติใบเสร็จของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดโดยอัตโนมัติหรือไม่?')) {
      return
    }

    setAutoApproving(true)
    try {
      const response = await fetch('/api/admin/receipts/auto-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`อนุมัติสำเร็จ ${result.approved_count} ใบเสร็จ`)
        if (result.error_count > 0) {
          toast.warning(`มีข้อผิดพลาด ${result.error_count} รายการ`)
        }
        fetchRecentReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติอัตโนมัติ')
    } finally {
      setAutoApproving(false)
    }
  }
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">ยินดีต้อนรับสู่ระบบจัดการผู้ดูแล Hughome CRM</p>
      </div>

      {/* Point Settings */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center">
            <Settings className="mr-2 h-5 w-5 text-slate-400" />
            ตั้งค่าอัตราแลกเปลี่ยน Point
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-row space-y-4">
          {loading ? (
            <p className="text-slate-500">กำลังโหลด...</p>
          ) : (
            <div className="flex items-end space-x-4 w-full mr-8">
              <div className="flex-1">
                <Label htmlFor="bahtPerPoint" className="text-slate-700">จำนวนบาทต่อ 1 Point</Label>
                <Input
                  id="bahtPerPoint"
                  type="number"
                  step="0.01"
                  value={bahtPerPoint}
                  onChange={(e) => setBahtPerPoint(e.target.value)}
                  placeholder="100.00"
                  className="mt-1 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  ตัวอย่าง: ใส่ 100 หมายถึง ใช้เงิน 100 บาท ได้ 1 Point
                </p>
              </div>
            </div>
          )}
              
          <Button
                onClick={savePointSetting}
                disabled={saving}
                className="bg-slate-900 flex mt-7  text-white hover:bg-slate-800"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>        
          
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">การดำเนินการด่วน</CardTitle>
          <CardDescription className="text-slate-600">
            ฟีเจอร์ที่ใช้บ่อยสำหรับการจัดการระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/admin/users">
            <Button variant="outline" className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
              <Users className="mr-2 h-4 w-4" />
              ดูผู้ใช้ทั้งหมด
            </Button>
          </Link>
          <Link href="/admin/receipts">
            <Button variant="outline" className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
              <Receipt className="mr-2 h-4 w-4" />
              ใบเสร็จรอการอนุมัติ
            </Button>
          </Link>
          <Link href="/admin/rewards">
            <Button variant="outline" className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
              <Gift className="mr-2 h-4 w-4" />
              เพิ่มรางวัลใหม่
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Receipts */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 flex items-center justify-between">
            <div className="flex items-center">
              <Receipt className="mr-2 h-5 w-5 text-slate-400" />
              รายการใบเสร็จล่าสุด
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleAutoApprove}
                disabled={autoApproving}
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Zap className="mr-1 h-3 w-3" />
                {autoApproving ? 'กำลังอนุมัติ...' : 'อนุมัติอัตโนมัติ'}
              </Button>
              <Link href="/admin/receipts">
                <Button variant="outline" size="sm" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
                  ดูทั้งหมด
                </Button>
              </Link>
            </div>
          </CardTitle>
          <CardDescription className="text-slate-600">
            ใบเสร็จที่รอการอนุมัติ 10 รายการล่าสุด
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receiptsLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
              <p className="text-slate-500 text-sm">กำลังโหลด...</p>
            </div>
          ) : recentReceipts.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="mx-auto h-12 w-12 text-slate-400 mb-2" />
              <p className="text-slate-500">ไม่มีใบเสร็จรอการอนุมัติ</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentReceipts.map((receipt) => {
                const user = receipt.user_profiles
                const displayName = user?.display_name || user?.first_name || 'ไม่ระบุชื่อ'
                const points = receipt.total_amount ? calculatePoints(receipt.total_amount) : 0

                // Extract store name from OCR data
                const ocrData = receipt.ocr_data
                let storeName = 'ไม่ระบุร้าน'

                if (ocrData && typeof ocrData === 'object') {
                  const storeField = (ocrData as any).ชื่อร้าน || (ocrData as any)["ชื่อร้าน"]
                  if (storeField === true) {
                    storeName = 'ตั้งหง่วงเซ้ง'
                  } else if (storeField === false) {
                    storeName = 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง'
                  }
                }

                return (
                  <div key={receipt.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-sm text-slate-900">{displayName}</span>
                        {getStatusBadge(receipt.status || 'pending')}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs text-slate-600">
                        <div>
                          <span className="font-medium">ยอดเงิน:</span> ฿{receipt.total_amount?.toLocaleString() || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">วันที่ใบเสร็จ:</span> {
                            receipt.receipt_date
                              ? new Date(receipt.receipt_date).toLocaleDateString('th-TH')
                              : 'N/A'
                          }
                        </div>
                        <div>
                          <span className="font-medium">วันที่อัปโหลด:</span> {
                            receipt.created_at
                              ? new Date(receipt.created_at).toLocaleDateString('th-TH')
                              : 'N/A'
                          }
                        </div>
                        <div>
                          <span className="font-medium">Points:</span> {points}
                        </div>
                        <div className="truncate">
                          <span className="font-medium">ร้าน:</span>
                          <span className={storeName === 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง' ? 'text-red-500 font-medium' : ''}>
                            {storeName}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-1 ml-2">
                      <Link href="/admin/receipts">
                        <Button variant="outline" size="sm" className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
                          ดูรายละเอียด
                        </Button>
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
