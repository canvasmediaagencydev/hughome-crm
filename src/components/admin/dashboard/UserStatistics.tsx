import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { DashboardMetrics } from '@/hooks/useDashboard'

interface UserStatisticsProps {
  metrics: DashboardMetrics
  loading: boolean
}

export function UserStatistics({ metrics, loading }: UserStatisticsProps) {
  return (
    <Card className="bg-white rounded-lg border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-slate-900 flex items-center justify-between">
          <div className="flex items-center">
            <Users className="mr-2 h-5 w-5 text-slate-400" />
            สถิติผู้ใช้งาน
          </div>
          <Link href="/admin/users">
            <Button
              variant="outline"
              size="sm"
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
            >
              ดูผู้ใช้ทั้งหมด
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '-' : metrics.contractorCount.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">ช่าง</div>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '-' : metrics.homeownerCount.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">เจ้าของบ้าน</div>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? '-' : metrics.monthlyActiveUsers.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">ผู้สมัครเดือนนี้</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
