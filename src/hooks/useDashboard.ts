import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import { createClient } from '@/lib/supabase-browser'
import { Tables } from '../../database.types'

type PointSetting = Tables<'point_settings'>

export type DateRange = '7d' | '30d' | '90d' | 'all' | 'custom'
export type RoleFilter = 'all' | 'contractor' | 'homeowner'

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
  [key: string]: string | number
}

interface DashboardData {
  metrics: DashboardMetrics & { pointSettings: PointSetting[] }
  recentReceipts: any[]
  analytics: TimeSeriesData[]
}

const PRESET_DAYS: Partial<Record<DateRange, number>> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

async function fetchDashboardData(
  dateRange: DateRange,
  roleFilter: RoleFilter,
  customStart: string,
  customEnd: string,
): Promise<DashboardData> {
  const params = new URLSearchParams({ role: roleFilter })
  if (dateRange === 'all') {
    // no date params → all-time
  } else if (dateRange === 'custom' && customStart && customEnd) {
    params.set('startDate', customStart)
    params.set('endDate', customEnd)
  } else if (PRESET_DAYS[dateRange]) {
    params.set('days', PRESET_DAYS[dateRange]!.toString())
  }
  const response = await axiosAdmin.get(`/api/admin/dashboard/all?${params}`)
  return response.data
}

export function useDashboard() {
  const queryClient = useQueryClient()
  const [bahtPerPoint, setBahtPerPoint] = useState('')
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [hasSession, setHasSession] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('7d')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(!!session)
    }
    checkSession()
  }, [])

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['dashboard', 'all', dateRange, roleFilter, customStart, customEnd],
    queryFn: () => fetchDashboardData(dateRange, roleFilter, customStart, customEnd),
    enabled: hasSession,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  })

  const dashboardMetrics: DashboardMetrics = data?.metrics || {
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
  }

  const recentReceipts = data?.recentReceipts || []
  const timeSeriesData = data?.analytics || []

  if (data?.metrics?.pointSettings && !pointSetting) {
    const bahtSetting = data.metrics.pointSettings.find(
      (s: PointSetting) => s.setting_key === 'baht_per_point'
    )
    if (bahtSetting) {
      setPointSetting(bahtSetting)
      setBahtPerPoint(bahtSetting.setting_value.toString())
    }
  }

  const userDistribution: ChartData[] = [
    { name: 'ช่าง', value: dashboardMetrics.contractorCount },
    { name: 'เจ้าของบ้าน', value: dashboardMetrics.homeownerCount }
  ]

  const receiptStatusDistribution: ChartData[] = [
    { name: 'รออนุมัติ', value: dashboardMetrics.pendingReceipts },
    { name: 'อนุมัติแล้ว', value: dashboardMetrics.approvedReceipts },
    { name: 'ปฏิเสธแล้ว', value: dashboardMetrics.rejectedReceipts }
  ]

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูล dashboard ได้'
    if (errorMessage.includes('Forbidden')) {
      toast.error('คุณไม่มีสิทธิ์ดูข้อมูล Dashboard')
    } else if (errorMessage.includes('Unauthorized')) {
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    } else {
      toast.error(errorMessage)
    }
  }

  const fetchAllDashboardData = async () => {
    await refetch()
  }

  return {
    loading: isLoading,
    metricsLoading: isLoading,
    receiptsLoading: isLoading,
    dashboardMetrics,
    recentReceipts,
    timeSeriesData,
    userDistribution,
    receiptStatusDistribution,
    pointSetting,
    bahtPerPoint,
    dateRange,
    setDateRange,
    roleFilter,
    setRoleFilter,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    setBahtPerPoint,
    setPointSetting,
    fetchAllDashboardData
  }
}
