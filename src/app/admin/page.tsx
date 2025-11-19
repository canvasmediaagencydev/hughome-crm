'use client'

import { useEffect, useMemo, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDashboard } from '@/hooks/useDashboard'
import { usePointSettings } from '@/hooks/usePointSettings'
import { DashboardMetrics } from '@/components/admin/dashboard/DashboardMetrics'
import { UserStatistics } from '@/components/admin/dashboard/UserStatistics'
import { TimeSeriesChart } from '@/components/admin/dashboard/TimeSeriesChart'
import { ReceiptStatusChart } from '@/components/admin/dashboard/ReceiptStatusChart'
import { UserDistributionChart } from '@/components/admin/dashboard/UserDistributionChart'
import { UsageStatistics } from '@/components/admin/dashboard/UsageStatistics'
import { RecentReceiptsTable } from '@/components/admin/dashboard/RecentReceiptsTable'
import { PointSettingsForm } from '@/components/admin/dashboard/PointSettingsForm'
import { QuickActions } from '@/components/admin/dashboard/QuickActions'
import { MetricCardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { calculatePoints } from '@/utils/receiptHelpers'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic'

export default function AdminDashboard() {
  const {
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
    setBahtPerPoint,
    fetchAllDashboardData
  } = useDashboard()

  const { saving, savePointSetting } = usePointSettings()
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const canViewDashboard = hasPermission(PERMISSIONS.DASHBOARD_VIEW) || isSuperAdmin
  const canEditSettings = hasPermission(PERMISSIONS.SETTINGS_EDIT) || isSuperAdmin

  // Remove manual fetch - React Query handles this automatically

  const handleSavePointSetting = async () => {
    const success = await savePointSetting(pointSetting, bahtPerPoint, fetchAllDashboardData)
  }

  const calcPoints = (totalAmount: number) => {
    if (!pointSetting) return 0
    return calculatePoints(totalAmount, pointSetting.setting_value)
  }

  const visibleTabs = useMemo(() => {
    const tabs = [
      {
        value: 'overview',
        label: 'ภาพรวม',
        show: true,
      },
      {
        value: 'analytics',
        label: 'การวิเคราะห์ และตั้งค่า',
        show: canEditSettings,
      },
    ]

    return tabs.filter((tab) => tab.show)
  }, [canEditSettings])

  const defaultTab = visibleTabs[0]?.value ?? 'overview'
  const [activeTab, setActiveTab] = useState(defaultTab)

  useEffect(() => {
    setActiveTab(defaultTab)
  }, [defaultTab])

  if (!canViewDashboard) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">ไม่มีสิทธิ์เข้าถึง Dashboard</h2>
          <p className="text-slate-600 text-sm">
            โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ดูข้อมูล Dashboard
          </p>
        </div>
      </div>
    )
  }

  const tabsListCols = visibleTabs.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
  const showAnalyticsTab = visibleTabs.some((tab) => tab.value === 'analytics')

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${tabsListCols}`}>
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Cards */}
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <MetricCardSkeleton key={i} />)}
            </div>
          ) : (
            <DashboardMetrics metrics={dashboardMetrics} loading={false} />
          )}

          {/* User Statistics */}
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <MetricCardSkeleton key={i} />)}
            </div>
          ) : (
            <UserStatistics metrics={dashboardMetrics} loading={false} />
          )}

          {/* Charts Row */}
          {metricsLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton />
              <ChartSkeleton />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TimeSeriesChart data={timeSeriesData} />
              <ReceiptStatusChart data={receiptStatusDistribution} />
            </div>
          )}

          {/* Recent Receipts */}
          {receiptsLoading ? (
            <TableSkeleton rows={5} />
          ) : (
            <RecentReceiptsTable
              receipts={recentReceipts}
              loading={false}
              calculatePoints={calcPoints}
            />
          )}
        </TabsContent>

        {showAnalyticsTab && (
          <TabsContent value="analytics" className="space-y-6">
            {metricsLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UserDistributionChart data={userDistribution} />
                <UsageStatistics metrics={dashboardMetrics} loading={false} />
              </div>
            )}

            {/* Point Settings */}
            <PointSettingsForm
              bahtPerPoint={bahtPerPoint}
              setBahtPerPoint={setBahtPerPoint}
              loading={loading}
              saving={saving}
              onSave={handleSavePointSetting}
              canEdit={canEditSettings}
            />

            {/* Quick Actions */}
            <QuickActions />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
