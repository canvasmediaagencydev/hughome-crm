/**
 * ข้อมูลหน้า /admin (Sprint 9R A6)
 * ช่วงวันที่: เดือนนี้ (ค่าเริ่มต้น) · 30 วัน · 90 วัน · กำหนดเอง → ส่ง ?from=&to= ให้ /api/admin/dashboard/all
 * metric ทุกตัวมาจาก batch / ledger / transactions เท่านั้น
 */
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import { createClient } from '@/lib/supabase-browser'
import { addDays, todayBangkok } from '@/lib/bangkok-date'
import { Tables } from '../../database.types'

type PointSetting = Tables<'point_settings'>

export type DateRange = 'this_month' | '30d' | '90d' | 'custom'
export type RoleFilter = 'all' | 'contractor' | 'homeowner'

export interface DashboardMetrics {
  range: { from: string; to: string }
  totalUsers: number
  contractorCount: number
  homeownerCount: number
  newUsersInRange: number
  pendingApprovalBatches: number
  batchesCommittedInRange: number
  pointsIssuedInRange: number
  pointsRedeemedInRange: number
  activeRewards: number
  pendingRedemptions: number
}

export interface ChartData {
  name: string
  value: number
  [key: string]: string | number
}

interface DashboardData {
  metrics: DashboardMetrics & { pointSettings: PointSetting[] }
}

const EMPTY_METRICS: DashboardMetrics = {
  range: { from: '', to: '' },
  totalUsers: 0,
  contractorCount: 0,
  homeownerCount: 0,
  newUsersInRange: 0,
  pendingApprovalBatches: 0,
  batchesCommittedInRange: 0,
  pointsIssuedInRange: 0,
  pointsRedeemedInRange: 0,
  activeRewards: 0,
  pendingRedemptions: 0,
}

/** ช่วงวันที่ (ตามเวลาไทย) ของ preset · custom ที่ยังเลือกไม่ครบ → null (ไม่ยิง API) */
export function resolveRange(
  dateRange: DateRange,
  customStart: string,
  customEnd: string
): { from: string; to: string } | null {
  const today = todayBangkok()
  if (dateRange === 'this_month') {
    const [y, m] = today.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(last).padStart(2, '0')}` }
  }
  if (dateRange === '30d') return { from: addDays(today, -29), to: today }
  if (dateRange === '90d') return { from: addDays(today, -89), to: today }
  if (customStart && customEnd && customStart <= customEnd) return { from: customStart, to: customEnd }
  return null
}

async function fetchDashboardData(range: { from: string; to: string }, roleFilter: RoleFilter): Promise<DashboardData> {
  const params = new URLSearchParams({ role: roleFilter, from: range.from, to: range.to })
  const response = await axiosAdmin.get(`/api/admin/dashboard/all?${params}`)
  return response.data
}

export function useDashboard() {
  const queryClient = useQueryClient()
  void queryClient
  const [bahtPerPoint, setBahtPerPoint] = useState('')
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)
  const [hasSession, setHasSession] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('this_month')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [customStart, setCustomStart] = useState<string>('')
  const [customEnd, setCustomEnd] = useState<string>('')

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setHasSession(!!session)
    }
    checkSession()
  }, [])

  const range = resolveRange(dateRange, customStart, customEnd)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard', 'all', range?.from, range?.to, roleFilter],
    queryFn: () => fetchDashboardData(range as { from: string; to: string }, roleFilter),
    enabled: hasSession && range !== null,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  })

  const dashboardMetrics: DashboardMetrics = data?.metrics || EMPTY_METRICS

  if (data?.metrics?.pointSettings && !pointSetting) {
    const bahtSetting = data.metrics.pointSettings.find((s: PointSetting) => s.setting_key === 'baht_per_point')
    if (bahtSetting) {
      setPointSetting(bahtSetting)
      setBahtPerPoint(bahtSetting.setting_value.toString())
    }
  }

  const userDistribution: ChartData[] = [
    { name: 'ช่าง', value: dashboardMetrics.contractorCount },
    { name: 'เจ้าของบ้าน', value: dashboardMetrics.homeownerCount },
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
    dashboardMetrics,
    userDistribution,
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
    fetchAllDashboardData,
    /** ช่วงที่ใช้จริง (null = custom ยังเลือกไม่ครบ) */
    activeRange: range,
  }
}
