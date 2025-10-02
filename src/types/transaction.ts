// Transaction-related type definitions

export interface Transaction {
  id: string
  points: number
  transaction_type: string
  description: string | null
  created_at: string
  balance_after: number | null
}

export interface TransactionPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
