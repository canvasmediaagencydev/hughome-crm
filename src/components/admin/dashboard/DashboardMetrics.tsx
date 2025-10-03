import { Card, CardContent } from '@/components/ui/card'
import { Users, Receipt, DollarSign, Gift, Activity, Clock } from 'lucide-react'
import { DashboardMetrics as Metrics } from '@/hooks/useDashboard'

interface DashboardMetricsProps {
  metrics: Metrics
  loading: boolean
}

export function DashboardMetrics({ metrics, loading }: DashboardMetricsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Users */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">ผู้ใช้ทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '-' : metrics.totalUsers.toLocaleString()}
              </p>
              <div className="flex items-center text-xs text-slate-500 mt-1">
                <Activity className="h-3 w-3 mr-1" />
                +{metrics.monthlyActiveUsers} ผู้สมัครเดือนนี้
              </div>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg">
              <Users className="h-6 w-6 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Receipts */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">ใบเสร็จทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '-' : metrics.totalReceipts.toLocaleString()}
              </p>
              <div className="flex items-center text-xs text-slate-500 mt-1">
                <Clock className="h-3 w-3 mr-1" />
                {metrics.pendingReceipts} รออนุมัติ
              </div>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg">
              <Receipt className="h-6 w-6 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Value */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">มูลค่ารวม</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '-' : `฿${metrics.totalReceiptValue.toLocaleString()}`}
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

      {/* Active Rewards */}
      <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">รางวัลที่ใช้งานได้</p>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? '-' : metrics.activeRewards.toLocaleString()}
              </p>
              <div className="flex items-center text-xs text-slate-500 mt-1">
                <Gift className="h-3 w-3 mr-1" />
                {metrics.pendingRedemptions} รอดำเนินการ
              </div>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg">
              <Gift className="h-6 w-6 text-slate-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
