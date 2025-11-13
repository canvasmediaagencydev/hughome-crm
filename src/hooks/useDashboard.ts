import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  [key: string]: string | number
}

interface DashboardData {
  metrics: DashboardMetrics & { pointSettings: PointSetting[] }
  recentReceipts: any[]
  analytics: TimeSeriesData[]
}

async function fetchDashboardData(): Promise<DashboardData> {
  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  const { data: { session } } = await supabaseAdmin.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No session found')
  }

  const response = await fetch('/api/admin/dashboard/all', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Forbidden: You do not have permission to view dashboard')
    }
    if (response.status === 401) {
      throw new Error('Unauthorized: Session expired')
    }
    throw new Error('Failed to fetch dashboard data')
  }

  return response.json()
}

export function useDashboard() {
  const queryClient = useQueryClient()
  const [bahtPerPoint, setBahtPerPoint] = useState('')
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [hasSession, setHasSession] = useState(false)

  // Check session availability
  useEffect(() => {
    const checkSession = async () => {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()
      setHasSession(!!session)
    }
    checkSession()
  }, [])

  // Main dashboard data query with React Query
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['dashboard', 'all'],
    queryFn: fetchDashboardData,
    enabled: hasSession, // Only fetch when session is available
    staleTime: 2 * 60 * 1000, // Data is fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })

  // Process data when available
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

  // Point settings
  if (data?.metrics?.pointSettings && !pointSetting) {
    const bahtSetting = data.metrics.pointSettings.find(
      (s: PointSetting) => s.setting_key === 'baht_per_point'
    )
    if (bahtSetting) {
      setPointSetting(bahtSetting)
      setBahtPerPoint(bahtSetting.setting_value.toString())
    }
  }

  // Chart data
  const userDistribution: ChartData[] = [
    { name: 'ช่าง', value: dashboardMetrics.contractorCount },
    { name: 'เจ้าของบ้าน', value: dashboardMetrics.homeownerCount }
  ]

  const receiptStatusDistribution: ChartData[] = [
    { name: 'รออนุมัติ', value: dashboardMetrics.pendingReceipts },
    { name: 'อนุมัติแล้ว', value: dashboardMetrics.approvedReceipts },
    { name: 'ปฏิเสธแล้ว', value: dashboardMetrics.rejectedReceipts }
  ]

  // Handle errors
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
    // State
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

    // Setters
    setBahtPerPoint,
    setPointSetting,

    // Actions
    fetchAllDashboardData
  }
}
