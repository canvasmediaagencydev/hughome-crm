import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Re-export all utility functions
export {
  formatDate,
  formatNumber,
  formatPoints,
  formatCurrency,
  getUserDisplayName,
  getAvatarUrl
} from './utils/formatters'

export {
  getTransactionTypeLabel,
  getTransactionColor,
  getRedemptionStatusLabel,
  getRedemptionStatusColor,
  getRoleLabel
} from './utils/labels'