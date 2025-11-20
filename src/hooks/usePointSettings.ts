import { useState } from 'react'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import { Tables } from '../../database.types'

type PointSetting = Tables<'point_settings'>

export function usePointSettings() {
  const [saving, setSaving] = useState(false)

  const savePointSetting = async (
    pointSetting: PointSetting | null,
    bahtPerPoint: string,
    onSuccess?: () => void
  ) => {
    setSaving(true)
    try {
      const value = parseFloat(bahtPerPoint)
      if (isNaN(value) || value <= 0) {
        toast.error('กรุณาใส่ตัวเลขที่ถูกต้อง')
        return false
      }

      const url = '/api/admin/point-settings'
      const method = pointSetting ? 'put' : 'post'
      const body = pointSetting
        ? { id: pointSetting.id, setting_value: value }
        : {
            setting_key: 'baht_per_point',
            setting_value: value,
            description: 'Amount in Thai Baht required to earn 1 point',
            is_active: true
          }

      await axiosAdmin[method](url, body)

      toast.success('บันทึกสำเร็จ!')
      onSuccess?.()
      return true
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('คุณไม่มีสิทธิ์แก้ไขการตั้งค่านี้')
        return false
      }

      const errorData = error.response?.data
      if (errorData?.error) {
        toast.error(errorData.error)
      } else {
        console.error('Failed to save point setting:', error)
        toast.error('เกิดข้อผิดพลาด')
      }
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    saving,
    savePointSetting
  }
}
