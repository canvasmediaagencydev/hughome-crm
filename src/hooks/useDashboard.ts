import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Tables } from '../../database.types'

type PointSetting = Tables<'point_settings'>

export interface DashboardMetrics {
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

export interface TimeSeriesData {
  date: string
  users: number
  receipts: number
  points: number
}

export interface ChartData {
  name: string
  value: number
}

export function useDashboard() {
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(true)
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

  const [recentReceipts, setRecentReceipts] = useState<any[]>([])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [userDistribution, setUserDistribution] = useState<ChartData[]>([
    { name: 'ช่าง', value: 0 },
    { name: 'เจ้าของบ้าน', value: 0 }
  ])
  const [receiptStatusDistribution, setReceiptStatusDistribution] = useState<ChartData[]>([
    { name: 'รออนุมัติ', value: 0 },
    { name: 'อนุมัติแล้ว', value: 0 },
    { name: 'ปฏิเสธแล้ว', value: 0 }
  ])

  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [bahtPerPoint, setBahtPerPoint] = useState('')

  const fetchAllDashboardData = useCallback(async () => {
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
        const bahtSetting = data.metrics.pointSettings.find(
          (s: PointSetting) => s.setting_key === 'baht_per_point'
        )
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
  }, [])

  return {
    // State
    loading,
    metricsLoading,
    receiptsLoading,
    dashboardMetrics,
    recentReceipts,
    timeSeriesData,
    userDistribution,
    receiptStatusDistribution,
    pointSetting,
    bahtPerPoint,

    // Setters
    setBahtPerPoint,
    setPointSetting,

    // Actions
    fetchAllDashboardData
  }
}
