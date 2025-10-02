// Receipt-related type definitions
import { Tables } from '../../database.types'

export type ReceiptWithRelations = Tables<'receipts'> & {
  user_profiles: {
    id: string
    display_name: string | null
    first_name: string | null
    last_name: string | null
    line_user_id: string
  } | null
  receipt_images: {
    id: string
    file_name: string
    file_path: string
    file_size: number | null
    mime_type: string | null
  }[]
}

export interface ReceiptListResponse {
  receipts: ReceiptWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface OCRResult {
  ชื่อร้าน: boolean
  ยอดรวม: number
  วันที่: string
  ความถูกต้อง: number
}

export type PointSetting = Tables<'point_settings'>
