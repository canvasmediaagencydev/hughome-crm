import { REDEMPTION_STATUS_LABEL, isRedemptionStatus } from '@/lib/redemption-status'

/**
 * Transaction type labels mapping
 */
export function getTransactionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    earned: 'ได้รับแต้ม',
    spent: 'ใช้แต้ม',
    bonus: 'โบนัส',
    refund: 'คืนเงิน',
    expired: 'หมดอายุ'
  }
  return labels[type] || type
}

/**
 * Get transaction color class
 */
export function getTransactionColor(type: string): string {
  if (type === 'earned' || type === 'bonus' || type === 'refund') {
    return 'text-green-600'
  }
  return 'text-slate-600'
}

/**
 * Redemption status labels — 4 ขั้น + ยกเลิก (Sprint 8) · ค่าจริงอยู่ที่ src/lib/redemption-status.ts
 */
export function getRedemptionStatusLabel(status: string): string {
  return isRedemptionStatus(status) ? REDEMPTION_STATUS_LABEL[status] : status
}

/**
 * Redemption status color classes
 */
export function getRedemptionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    ready: 'bg-emerald-100 text-emerald-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700'
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

/**
 * Role labels mapping
 */
export function getRoleLabel(role: string | null): string {
  if (role === 'contractor') return 'Contractor'
  if (role === 'homeowner') return 'Homeowner'
  return 'ไม่ระบุ'
}
