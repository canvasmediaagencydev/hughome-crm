import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardMetrics } from '@/hooks/useDashboard'

interface UsageStatisticsProps {
  metrics: DashboardMetrics
  loading: boolean
}

export function UsageStatistics({ metrics, loading }: UsageStatisticsProps) {
  // Receipt-based stats removed (OCR flow gone). Points/batch stats are added
  // when the admin dashboard is rebuilt in Sprint 9.
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">สถิติการใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">ผู้สมัครเดือนนี้</span>
            <span className="font-medium text-slate-900">
              {loading ? '-' : metrics.monthlyActiveUsers.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
