// User-related type definitions

export interface Tag {
  id: string
  name: string
  color: string
  created_at: string
  created_by: string | null
  user_count?: number
  line_audience_id?: number | null
}

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
  last_login_at: string | null
  created_at: string
  customer_code: string | null
  birthday: string | null
  tags?: Tag[]
}

/** lot ที่จะหมดอายุเร็วที่สุด (Sprint 7) — null = ไม่มีแต้มค้าง */
export interface NextExpiry {
  points: number
  expires_at: string // 'YYYY-MM-DD'
}

export interface UserData {
  first_name: string
  last_name: string
  picture_url: string | null
  points_balance: number
  next_expiry?: NextExpiry | null
  displayName?: string
  pictureUrl?: string
  role?: string
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}
