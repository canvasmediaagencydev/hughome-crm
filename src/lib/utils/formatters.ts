/**
 * Format date to Thai locale
 */
export function formatDate(dateString: string, options?: {
  includeTime?: boolean
  timeOnly?: boolean
}): string {
  const date = new Date(dateString)

  if (options?.timeOnly) {
    return date.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(options?.includeTime && {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return date.toLocaleDateString('th-TH', dateOptions)
}

/**
 * Format number to locale string with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString()
}

/**
 * Format points display
 */
export function formatPoints(points: number): string {
  return `${formatNumber(points)} แต้ม`
}

/**
 * Format currency (Thai Baht)
 */
export function formatCurrency(amount: number): string {
  return `฿${formatNumber(amount)}`
}

/**
 * Get user display name from user object
 */
export function getUserDisplayName(user: {
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
}): string {
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
  return fullName || user.display_name || 'ไม่ระบุชื่อ'
}

/**
 * Get avatar URL or fallback to UI Avatars
 */
export function getAvatarUrl(pictureUrl: string | null, displayName: string): string {
  return pictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`
}
