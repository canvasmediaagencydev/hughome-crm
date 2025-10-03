import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardMetrics } from '@/hooks/useDashboard'

interface UsageStatisticsProps {
  metrics: DashboardMetrics
  loading: boolean
}

export function UsageStatistics({ metrics, loading }: UsageStatisticsProps) {
  const approvalRate =
    metrics.totalReceipts > 0
      ? ((metrics.approvedReceipts / metrics.totalReceipts) * 100).toFixed(1)
      : '0.0'

  const avgReceiptsPerUser =
    metrics.totalUsers > 0
      ? (metrics.totalReceipts / metrics.totalUsers).toFixed(1)
      : '0.0'

  const avgValuePerReceipt =
    metrics.totalReceipts > 0
      ? (metrics.totalReceiptValue / metrics.totalReceipts).toFixed(2)
      : '0.00'

  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">สถิติการใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">อัตราการอนุมัติใบเสร็จ</span>
            <span className="font-medium text-slate-900">
              {loading ? '-' : `${approvalRate}%`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">ผู้สมัครเดือนนี้</span>
            <span className="font-medium text-slate-900">
              {loading ? '-' : metrics.monthlyActiveUsers.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">ใบเสร็จเฉลี่ยต่อผู้ใช้</span>
            <span className="font-medium text-slate-900">
              {loading ? '-' : avgReceiptsPerUser}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">มูลค่าเฉลี่ยต่อใบเสร็จ</span>
            <span className="font-medium text-slate-900">
              {loading ? '-' : `฿${avgValuePerReceipt}`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
