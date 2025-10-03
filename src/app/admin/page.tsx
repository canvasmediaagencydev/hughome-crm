'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Users,
  Receipt,
  Gift,
  BarChart3,
  Settings,
  Save,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Target,
  ShoppingCart,
  DollarSign,
  Activity,
  Star
} from 'lucide-react'
import Link from 'next/link'
import { Tables } from '../../../database.types'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts'
import { format } from 'date-fns'

type PointSetting = Tables<'point_settings'>
type UserProfile = Tables<'user_profiles'>
type Receipt = Tables<'receipts'>
type Redemption = Tables<'redemptions'>
type Reward = Tables<'rewards'>

interface DashboardMetrics {
  totalUsers: number
  contractorCount: number
  homeownerCount: number
  totalReceipts: number
  pendingReceipts: number
  approvedReceipts: number
  rejectedReceipts: number
  totalPointsEarned: number
  totalPointsSpent: number
  activeRewards: number
  pendingRedemptions: number
  totalReceiptValue: number
  monthlyActiveUsers: number
  averageProcessingTime: number
}

interface TimeSeriesData {
  date: string
  users: number
  receipts: number
  points: number
}

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444']

export default function AdminDashboard() {
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [bahtPerPoint, setBahtPerPoint] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [recentReceipts, setRecentReceipts] = useState<any[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(true)
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({
    totalUsers: 0,
    contractorCount: 0,
    homeownerCount: 0,
    totalReceipts: 0,
    pendingReceipts: 0,
    approvedReceipts: 0,
    rejectedReceipts: 0,
    totalPointsEarned: 0,
    totalPointsSpent: 0,
    activeRewards: 0,
    pendingRedemptions: 0,
    totalReceiptValue: 0,
    monthlyActiveUsers: 0,
    averageProcessingTime: 0
  })
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [userDistribution, setUserDistribution] = useState([
    { name: 'ช่าง', value: 0 },
    { name: 'เจ้าของบ้าน', value: 0 }
  ])
  const [receiptStatusDistribution, setReceiptStatusDistribution] = useState([
    { name: 'รออนุมัติ', value: 0 },
    { name: 'อนุมัติแล้ว', value: 0 },
    { name: 'ปฏิเสธแล้ว', value: 0 }
  ])

  useEffect(() => {
    // Fetch all dashboard data in single API call
    fetchAllDashboardData()
  }, [])

  const fetchAllDashboardData = async () => {
    setLoading(true)
    setMetricsLoading(true)
    setReceiptsLoading(true)

    try {
      console.log('[Dashboard] Fetching all data in single API call...')
      const response = await fetch('/api/admin/dashboard/all')

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      console.log('[Dashboard] All data received:', data)

      // Set metrics
      setDashboardMetrics({
        totalUsers: data.metrics.totalUsers,
        contractorCount: data.metrics.contractorCount,
        homeownerCount: data.metrics.homeownerCount,
        totalReceipts: data.metrics.totalReceipts,
        pendingReceipts: data.metrics.pendingReceipts,
        approvedReceipts: data.metrics.approvedReceipts,
        rejectedReceipts: data.metrics.rejectedReceipts,
        totalPointsEarned: data.metrics.totalPointsEarned,
        totalPointsSpent: data.metrics.totalPointsSpent,
        activeRewards: data.metrics.activeRewards,
        pendingRedemptions: data.metrics.pendingRedemptions,
        totalReceiptValue: data.metrics.totalReceiptValue,
        monthlyActiveUsers: data.metrics.monthlyActiveUsers,
        averageProcessingTime: data.metrics.averageProcessingTime
      })

      // Set point settings
      if (data.metrics.pointSettings) {
        const bahtSetting = data.metrics.pointSettings.find((s: PointSetting) => s.setting_key === 'baht_per_point')
        if (bahtSetting) {
          setPointSetting(bahtSetting)
          setBahtPerPoint(bahtSetting.setting_value.toString())
        }
      }

      // Set recent receipts
      setRecentReceipts(data.recentReceipts || [])

      // Set analytics data
      setTimeSeriesData(data.analytics || [])

      // Update chart data
      setUserDistribution([
        { name: 'ช่าง', value: data.metrics.contractorCount },
        { name: 'เจ้าของบ้าน', value: data.metrics.homeownerCount }
      ])

      setReceiptStatusDistribution([
        { name: 'รออนุมัติ', value: data.metrics.pendingReceipts },
        { name: 'อนุมัติแล้ว', value: data.metrics.approvedReceipts },
        { name: 'ปฏิเสธแล้ว', value: data.metrics.rejectedReceipts }
      ])

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      toast.error('ไม่สามารถโหลดข้อมูล dashboard ได้')
    } finally {
      setLoading(false)
      setMetricsLoading(false)
      setReceiptsLoading(false)
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
        // Refetch all dashboard data to get updated point settings
        await fetchAllDashboardData()
        toast.success('บันทึกสำเร็จ!')
      }
    } catch (error) {
      console.error('Failed to save point setting:', error)
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSaving(false)
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

  
  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
          <TabsTrigger value="analytics">การวิเคราะห์ และตั้งค่า</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">ผู้ใช้ทั้งหมด</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {metricsLoading ? '-' : dashboardMetrics.totalUsers.toLocaleString()}
                    </p>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <Activity className="h-3 w-3 mr-1" />
                      +{dashboardMetrics.monthlyActiveUsers} ผู้สมัครเดือนนี้
                    </div>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Users className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">ใบเสร็จทั้งหมด</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {metricsLoading ? '-' : dashboardMetrics.totalReceipts.toLocaleString()}
                    </p>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {dashboardMetrics.pendingReceipts} รออนุมัติ
                    </div>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Receipt className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">มูลค่ารวม</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {metricsLoading ? '-' : `฿${dashboardMetrics.totalReceiptValue.toLocaleString()}`}
                    </p>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <DollarSign className="h-3 w-3 mr-1" />
                      ยอดเงินทั้งหมด
                    </div>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600">รางวัลที่ใช้งานได้</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {metricsLoading ? '-' : dashboardMetrics.activeRewards.toLocaleString()}
                    </p>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <Gift className="h-3 w-3 mr-1" />
                      {dashboardMetrics.pendingRedemptions} รอดำเนินการ
                    </div>
                  </div>
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Gift className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Statistics */}
          <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="mr-2 h-5 w-5 text-slate-400" />
                  สถิติผู้ใช้งาน
                </div>
                <Link href="/admin/users">
                  <Button variant="outline" size="sm" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200">
                    ดูผู้ใช้ทั้งหมด
                  </Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">
                    {metricsLoading ? '-' : dashboardMetrics.contractorCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-600">ช่าง</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">
                    {metricsLoading ? '-' : dashboardMetrics.homeownerCount.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-600">เจ้าของบ้าน</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900">
                    {metricsLoading ? '-' : dashboardMetrics.monthlyActiveUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-slate-600">ผู้สมัครเดือนนี้</div>
                </div>
              </div>
            </CardContent>
          </Card>

          
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-white to-slate-50 rounded-xl border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  แนวโน้ม 30 วันล่าสุด
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart
                    data={timeSeriesData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="receiptGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: '10px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="url(#userGradient)"
                      strokeWidth={3}
                      name="ผู้ใช้ใหม่"
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="receipts"
                      stroke="url(#receiptGradient)"
                      strokeWidth={3}
                      name="ใบเสร็จ"
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900">สถานะใบเสร็จ</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={receiptStatusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {receiptStatusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{
                        paddingTop: '20px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Receipts */}
          <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 flex items-center justify-between">
                <div className="flex items-center">
                  <Receipt className="mr-2 h-5 w-5 text-slate-400" />
                  รายการใบเสร็จล่าสุด
                </div>
                <div className="flex space-x-2">
                  <Link href="/admin/receipts">
                    <Button variant="outline" size="sm" className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200">
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
                            <Button variant="outline" size="sm" className="text-xs bg-white text-slate-700 hover:bg-slate-50 border border-slate-200">
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
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">การกระจายตัวผู้ใช้งาน</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={userDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {userDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900">สถิติการใช้งาน</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">อัตราการอนุมัติใบเสร็จ</span>
                    <span className="font-medium text-slate-900">
                      {metricsLoading ? '-' : `${((dashboardMetrics.approvedReceipts / dashboardMetrics.totalReceipts) * 100 || 0).toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">ผู้สมัครเดือนนี้</span>
                    <span className="font-medium text-slate-900">
                      {metricsLoading ? '-' : dashboardMetrics.monthlyActiveUsers.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">ใบเสร็จเฉลี่ยต่อผู้ใช้</span>
                    <span className="font-medium text-slate-900">
                      {metricsLoading ? '-' : (dashboardMetrics.totalReceipts / dashboardMetrics.totalUsers || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600">มูลค่าเฉลี่ยต่อใบเสร็จ</span>
                    <span className="font-medium text-slate-900">
                      {metricsLoading ? '-' : `฿${(dashboardMetrics.totalReceiptValue / dashboardMetrics.totalReceipts || 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                <Button variant="outline" className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200">
                  <Users className="mr-2 h-4 w-4" />
                  ดูผู้ใช้ทั้งหมด
                </Button>
              </Link>
              <Link href="/admin/receipts">
                <Button variant="outline" className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200">
                  <Receipt className="mr-2 h-4 w-4" />
                  ใบเสร็จรอการอนุมัติ
                </Button>
              </Link>
              <Link href="/admin/rewards">
                <Button variant="outline" className="w-full bg-white text-slate-700 hover:bg-slate-50 border border-slate-200">
                  <Gift className="mr-2 h-4 w-4" />
                  เพิ่มรางวัลใหม่
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
