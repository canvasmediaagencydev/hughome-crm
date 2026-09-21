import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardMetrics } from '@/hooks/useDashboard'

interface UsageStatisticsProps {
  metrics: DashboardMetrics
  loading: boolean
}

/** สถิติในช่วงที่เลือก (Sprint 9R A6) — ตัวเลขชุดเดียวกับการ์ดหน้าแรก จัดเป็นตาราง */
export function UsageStatistics({ metrics, loading }: UsageStatisticsProps) {
  const n = (v: number) => (loading ? '-' : v.toLocaleString())
  const rows: [string, string][] = [
    ['ชุดที่รอผู้อนุมัติ (ตอนนี้)', n(metrics.pendingApprovalBatches)],
    ['ชุดที่อนุมัติในช่วง', n(metrics.batchesCommittedInRange)],
    ['แต้มออกในช่วง', n(metrics.pointsIssuedInRange)],
    ['แต้มแลกในช่วง', n(metrics.pointsRedeemedInRange)],
    ['ลูกค้าใหม่ในช่วง', n(metrics.newUsersInRange)],
    ['คำขอแลกที่รอดำเนินการ (ตอนนี้)', n(metrics.pendingRedemptions)],
  ]
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900">สถิติการใช้งาน</CardTitle>
        {metrics.range.from && (
          <p className="text-xs text-slate-500">
            ช่วง {metrics.range.from} → {metrics.range.to}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-center">
              <span className="text-sm text-slate-600">{label}</span>
              <span className="font-medium text-slate-900 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
