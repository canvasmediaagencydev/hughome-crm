'use client'

import { useState } from 'react'
import { Shield, FileText, Download, Search, Loader2 } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'

interface UserReport {
  created_at: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  points_balance: number | null
}

interface ReportResponse {
  start_date: string
  end_date: string
  total_count: number
  generated_at: string
  users: UserReport[]
}

function formatThaiDate(dateString: string): string {
  const date = new Date(dateString)
  const buddhistYear = date.getFullYear() + 543
  const formatted = format(date, 'dd/MM/yyyy HH:mm')
  return formatted.replace(String(date.getFullYear()), String(buddhistYear))
}

function formatPhone(phone: string | null): string {
  if (!phone) return '-'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}

export default function AdminReportsPage() {
  const { hasPermission, loading: authLoading } = useAdminAuth()

  // Default to current month
  const now = new Date()
  const defaultStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const defaultEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [reportData, setReportData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
          <p className="text-slate-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  if (!hasPermission(PERMISSIONS.USERS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการดูรายงาน</p>
        </div>
      </div>
    )
  }

  const fetchReport = async () => {
    if (!startDate || !endDate) {
      toast.error('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('วันที่เริ่มต้นต้องน้อยกว่าวันที่สิ้นสุด')
      return
    }

    setLoading(true)
    try {
      const res = await axiosAdmin.get(`/api/admin/reports/users?start=${startDate}&end=${endDate}`)
      setReportData(res.data)
    } catch (error) {
      console.error('Error fetching report:', error)
      toast.error('ไม่สามารถดึงข้อมูลได้')
    } finally {
      setLoading(false)
    }
  }

  const downloadExcel = async () => {
    if (!startDate || !endDate) {
      toast.error('กรุณาเลือกวันที่ก่อน')
      return
    }

    setDownloading(true)
    try {
      const res = await axiosAdmin.get(`/api/admin/reports/users/excel?start=${startDate}&end=${endDate}`, {
        responseType: 'blob'
      })
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-report-${startDate}-to-${endDate}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('ดาวน์โหลด Excel สำเร็จ')
    } catch (error) {
      console.error('Error downloading Excel:', error)
      toast.error('ไม่สามารถสร้างไฟล์ได้')
    } finally {
      setDownloading(false)
    }
  }

  const setQuickRange = (range: 'thisMonth' | 'lastMonth' | 'last3Months') => {
    const now = new Date()
    let start: Date
    let end: Date

    switch (range) {
      case 'thisMonth':
        start = startOfMonth(now)
        end = endOfMonth(now)
        break
      case 'lastMonth':
        start = startOfMonth(subMonths(now, 1))
        end = endOfMonth(subMonths(now, 1))
        break
      case 'last3Months':
        start = startOfMonth(subMonths(now, 2))
        end = endOfMonth(now)
        break
    }

    setStartDate(format(start, 'yyyy-MM-dd'))
    setEndDate(format(end, 'yyyy-MM-dd'))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            รายงานข้อมูลลูกค้า
          </h1>
          <p className="text-slate-600 mt-1">ดึงข้อมูลลูกค้าตามช่วงเวลาที่กำหนด</p>
        </div>

        {/* Filter Card */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="startDate" className="text-slate-700">วันที่เริ่มต้น</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="endDate" className="text-slate-700">วันที่สิ้นสุด</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-44 mt-1"
              />
            </div>
            <Button onClick={fetchReport} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              ค้นหา
            </Button>
            <Button
              onClick={downloadExcel}
              disabled={downloading}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              ดาวน์โหลด Excel
            </Button>
          </div>

          {/* Quick select buttons */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickRange('thisMonth')}
              className="text-xs"
            >
              เดือนนี้
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickRange('lastMonth')}
              className="text-xs"
            >
              เดือนที่แล้ว
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickRange('last3Months')}
              className="text-xs"
            >
              3 เดือนล่าสุด
            </Button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20">
            <div className="relative inline-flex">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-900 border-t-transparent absolute top-0 left-0"></div>
            </div>
            <p className="text-slate-600 mt-6 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : reportData ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {/* Summary */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <span className="text-slate-500 text-sm">จำนวนลูกค้า</span>
                  <p className="text-2xl font-bold text-slate-900">{reportData.total_count} คน</p>
                </div>
                <div>
                  <span className="text-slate-500 text-sm">ช่วงเวลา</span>
                  <p className="text-lg font-medium text-slate-900">
                    {reportData.start_date} ถึง {reportData.end_date}
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            {reportData.users.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="w-16 text-center">ลำดับ</TableHead>
                    <TableHead className="w-40">วันที่สมัคร</TableHead>
                    <TableHead>ชื่อจริง</TableHead>
                    <TableHead>นามสกุล</TableHead>
                    <TableHead className="w-32 text-center">เบอร์โทร</TableHead>
                    <TableHead className="w-24 text-right">แต้มปัจจุบัน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.users.map((user, index) => (
                    <TableRow key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell>{formatThaiDate(user.created_at)}</TableCell>
                      <TableCell>{user.first_name || '-'}</TableCell>
                      <TableCell>{user.last_name || '-'}</TableCell>
                      <TableCell className="text-center">{formatPhone(user.phone)}</TableCell>
                      <TableCell className="text-right font-medium">{user.points_balance ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-16">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">ไม่มีข้อมูลในช่วงเวลานี้</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-16 text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">เลือกช่วงเวลาแล้วกด "ค้นหา" เพื่อดูรายงาน</p>
          </div>
        )}
      </div>
    </div>
  )
}
