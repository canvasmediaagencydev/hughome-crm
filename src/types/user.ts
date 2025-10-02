// User-related type definitions

export interface User {
  id: string
  line_user_id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  picture_url: string | null
  role: string | null
  points_balance: number | null
  is_admin: boolean | null
  last_login_at: string | null
  total_receipts: number | null
  created_at: string
}

export interface UserData {
  first_name: string
  last_name: string
  picture_url: string | null
  points_balance: number
  displayName?: string
  pictureUrl?: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
