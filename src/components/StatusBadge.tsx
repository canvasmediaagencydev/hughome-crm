import { memo } from 'react'
import { REDEMPTION_STATUS_LABEL, isRedemptionStatus, type RedemptionStatus } from '@/lib/redemption-status'

// Redemption statuses = 4 ขั้น + ยกเลิก (Sprint 8) — ค่าและ label อยู่ที่ src/lib/redemption-status.ts
type RoleType = 'contractor' | 'homeowner' | null

interface StatusBadgeProps {
  status: string
  type?: 'redemption'
}

const REDEMPTION_COLOR: Record<RedemptionStatus, string> = {
  requested: 'bg-amber-50 text-amber-600 border-amber-200',
  approved: 'bg-blue-50 text-blue-600 border-blue-200',
  ready: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  delivered: 'bg-slate-100 text-slate-600 border-slate-200',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
}

export const StatusBadge = memo(({ status }: StatusBadgeProps) => {
  const getRedemptionConfig = (status: string) => {
    if (isRedemptionStatus(status)) {
      return { text: REDEMPTION_STATUS_LABEL[status], color: REDEMPTION_COLOR[status] }
    }
    return { text: status, color: 'bg-slate-50 text-slate-500 border-slate-200' }
  }

  const config = getRedemptionConfig(status)

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      {config.text}
    </span>
  )
})
StatusBadge.displayName = 'StatusBadge'

interface RoleBadgeProps {
  role: RoleType
}

export const RoleBadge = memo(({ role }: RoleBadgeProps) => {
  const getRoleConfig = () => {
    if (role === 'contractor') return { text: 'Contractor', color: 'bg-blue-50 text-blue-600 border-blue-200' }
    if (role === 'homeowner') return { text: 'Homeowner', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
    return { text: 'ไม่ระบุ', color: 'bg-slate-50 text-slate-600 border-slate-200' }
  }

  const config = getRoleConfig()

  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      {config.text}
    </span>
  )
})
RoleBadge.displayName = 'RoleBadge'
