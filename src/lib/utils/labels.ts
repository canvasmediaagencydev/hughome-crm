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
  return 'text-red-600'
}

/**
 * Receipt status labels mapping
 */
export function getReceiptStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'รออนุมัติ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ถูกปฏิเสธ'
  }
  return labels[status] || status
}

/**
 * Redemption status labels mapping
 */
export function getRedemptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    requested: 'รอดำเนินการ',
    processing: 'กำลังจัดส่ง',
    shipped: 'จัดส่งแล้ว',
    cancelled: 'ยกเลิก'
  }
  return labels[status] || status
}

/**
 * Redemption status color classes
 */
export function getRedemptionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-700',
    processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-green-100 text-green-700',
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
