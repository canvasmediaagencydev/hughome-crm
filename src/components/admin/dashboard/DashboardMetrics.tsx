import { Card, CardContent } from '@/components/ui/card'
import { Users, Gift, Activity, ClipboardCheck, Coins, ArrowDownToLine } from 'lucide-react'
import Link from 'next/link'
import { DashboardMetrics as Metrics } from '@/hooks/useDashboard'

interface DashboardMetricsProps {
  metrics: Metrics
  loading: boolean
}

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  href,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof Users
  href?: string
  highlight?: boolean
}) {
  const body = (
    <Card className={`bg-white rounded-lg border shadow-sm ${highlight ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
            {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
          </div>
          <div className={`p-3 rounded-lg ${highlight ? 'bg-amber-100' : 'bg-slate-100'}`}>
            <Icon className={`h-6 w-6 ${highlight ? 'text-amber-700' : 'text-slate-600'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

/** ตัวเลขหลักบน /admin — "ในช่วง" = ตามช่วงวันที่ที่เลือก · ที่เหลือคือ ณ ตอนนี้ (Sprint 9R A6) */
export function DashboardMetrics({ metrics, loading }: DashboardMetricsProps) {
  const n = (v: number) => (loading ? '-' : v.toLocaleString())
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Tile
        label="ชุดยอดขายที่รอผู้อนุมัติ"
        value={n(metrics.pendingApprovalBatches)}
        sub={metrics.pendingApprovalBatches > 0 ? 'กดเพื่อไปอนุมัติ' : 'ไม่มีชุดค้าง'}
        icon={ClipboardCheck}
        href="/admin/batches"
        highlight={metrics.pendingApprovalBatches > 0}
      />
      <Tile
        label="แต้มออกในช่วง"
        value={n(metrics.pointsIssuedInRange)}
        sub={`จาก ${n(metrics.batchesCommittedInRange)} ชุดที่อนุมัติในช่วง (รวมปรับมือ)`}
        icon={Coins}
      />
      <Tile label="แต้มแลกในช่วง" value={n(metrics.pointsRedeemedInRange)} sub="แต้มที่ลูกค้าใช้แลกรางวัล" icon={ArrowDownToLine} />
      <Tile label="ลูกค้าใหม่ในช่วง" value={n(metrics.newUsersInRange)} sub={`ลูกค้าทั้งหมด ${n(metrics.totalUsers)} คน`} icon={Activity} />
      <Tile label="ลูกค้าทั้งหมด" value={n(metrics.totalUsers)} sub={`ช่าง ${n(metrics.contractorCount)} · เจ้าของบ้าน ${n(metrics.homeownerCount)}`} icon={Users} href="/admin/users" />
      <Tile
        label="รางวัลที่เปิดอยู่"
        value={n(metrics.activeRewards)}
        sub={`${n(metrics.pendingRedemptions)} คำขอแลกรอดำเนินการ`}
        icon={Gift}
        href="/admin/redemptions"
        highlight={metrics.pendingRedemptions > 0}
      />
    </div>
  )
}
