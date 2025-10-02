import { memo } from 'react'

type ReceiptStatus = 'pending' | 'approved' | 'rejected'
type RedemptionStatus = 'requested' | 'processing' | 'shipped' | 'cancelled'
type RoleType = 'contractor' | 'homeowner' | null

interface StatusBadgeProps {
  status: string
  type?: 'receipt' | 'redemption'
}

export const StatusBadge = memo(({ status, type = 'receipt' }: StatusBadgeProps) => {
  const getReceiptConfig = (status: string) => {
    const configs: Record<ReceiptStatus, { text: string; color: string }> = {
      pending: { text: 'รออนุมัติ', color: 'bg-slate-50 text-slate-600 border-slate-200' },
      approved: { text: 'อนุมัติแล้ว', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      rejected: { text: 'ถูกปฏิเสธ', color: 'bg-rose-50 text-rose-600 border-rose-200' }
    }
    return configs[status as ReceiptStatus] || configs.pending
  }

  const getRedemptionConfig = (status: string) => {
    const configs: Record<RedemptionStatus, { text: string; color: string }> = {
      requested: { text: 'รับสินค้าที่ร้าน', color: 'bg-amber-50 text-amber-600 border-amber-200' },
      processing: { text: 'กำลังจัดเตรียม', color: 'bg-blue-50 text-blue-600 border-blue-200' },
      shipped: { text: 'จัดส่งแล้ว', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
      cancelled: { text: 'ยกเลิก', color: 'bg-rose-50 text-rose-600 border-rose-200' }
    }
    return configs[status as RedemptionStatus] || configs.requested
  }

  const config = type === 'receipt' ? getReceiptConfig(status) : getRedemptionConfig(status)

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
