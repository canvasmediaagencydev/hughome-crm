'use client'

import { useEffect } from 'react'
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
import { calculatePoints } from '@/utils/receiptHelpers'

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

  useEffect(() => {
    fetchAllDashboardData()
  }, [])

  const handleSavePointSetting = async () => {
    const success = await savePointSetting(pointSetting, bahtPerPoint, fetchAllDashboardData)
  }

  const calcPoints = (totalAmount: number) => {
    if (!pointSetting) return 0
    return calculatePoints(totalAmount, pointSetting.setting_value)
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
          <DashboardMetrics metrics={dashboardMetrics} loading={metricsLoading} />

          {/* User Statistics */}
          <UserStatistics metrics={dashboardMetrics} loading={metricsLoading} />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TimeSeriesChart data={timeSeriesData} />
            <ReceiptStatusChart data={receiptStatusDistribution} />
          </div>

          {/* Recent Receipts */}
          <RecentReceiptsTable
            receipts={recentReceipts}
            loading={receiptsLoading}
            calculatePoints={calcPoints}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UserDistributionChart data={userDistribution} />
            <UsageStatistics metrics={dashboardMetrics} loading={metricsLoading} />
          </div>

          {/* Point Settings */}
          <PointSettingsForm
            bahtPerPoint={bahtPerPoint}
            setBahtPerPoint={setBahtPerPoint}
            loading={loading}
            saving={saving}
            onSave={handleSavePointSetting}
          />

          {/* Quick Actions */}
          <QuickActions />
        </TabsContent>
      </Tabs>
    </div>
  )
}
