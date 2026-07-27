import { memo } from 'react'

// NOTE: receipt status removed (OCR flow gone). Redemption statuses are still
// the old set here; they get updated to the 4-status model in Sprint 8.
type RedemptionStatus = 'requested' | 'processing' | 'shipped' | 'cancelled'
type RoleType = 'contractor' | 'homeowner' | null

interface StatusBadgeProps {
  status: string
  type?: 'redemption'
}

export const StatusBadge = memo(({ status }: StatusBadgeProps) => {
  const getRedemptionConfig = (status: string) => {
    const configs: Record<RedemptionStatus, { text: string; color: string }> = {
      requested: { text: 'รับสินค้าที่ร้าน', color: 'bg-amber-50 text-amber-600 border-amber-200' },
      processing: { text: 'กำลังจัดเตรียม', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      shipped: { text: 'จัดส่งแล้ว', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      cancelled: { text: 'ยกเลิก', color: 'bg-rose-50 text-rose-600 border-rose-200' }
    }
    return configs[status as RedemptionStatus] || configs.requested
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
