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
      pending: { text: 'รออนุมัติ', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
      approved: { text: 'อนุมัติแล้ว', color: 'bg-green-100 text-green-700 border-green-300' },
      rejected: { text: 'ถูกปฏิเสธ', color: 'bg-red-100 text-red-700 border-red-300' }
    }
    return configs[status as ReceiptStatus] || configs.pending
  }

  const getRedemptionConfig = (status: string) => {
    const configs: Record<RedemptionStatus, { text: string; color: string }> = {
      requested: { text: 'รับสินค้าที่ร้าน', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
      processing: { text: 'กำลังจัดเตรียม', color: 'bg-blue-100 text-blue-700 border-blue-300' },
      shipped: { text: 'จัดส่งแล้ว', color: 'bg-green-100 text-green-700 border-green-300' },
      cancelled: { text: 'ยกเลิก', color: 'bg-red-100 text-red-700 border-red-300' }
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
    if (role === 'contractor') return { text: 'Contractor', color: 'bg-blue-100 text-blue-700 border-blue-300' }
    if (role === 'homeowner') return { text: 'Homeowner', color: 'bg-green-100 text-green-700 border-green-300' }
    return { text: 'ไม่ระบุ', color: 'bg-gray-100 text-gray-700 border-gray-300' }
  }

  const config = getRoleConfig()

  return (
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      {config.text}
    </span>
  )
})
RoleBadge.displayName = 'RoleBadge'
