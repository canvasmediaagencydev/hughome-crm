import { useState } from 'react'
import { toast } from 'sonner'
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
      const method = pointSetting ? 'PUT' : 'POST'
      const body = pointSetting
        ? { id: pointSetting.id, setting_value: value }
        : {
            setting_key: 'baht_per_point',
            setting_value: value,
            description: 'Amount in Thai Baht required to earn 1 point',
            is_active: true
          }

      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return false
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        toast.success('บันทึกสำเร็จ!')
        onSuccess?.()
        return true
      }

      if (response.status === 403) {
        toast.error('คุณไม่มีสิทธิ์แก้ไขการตั้งค่านี้')
        return false
      }

      if (response.status === 401) {
        toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
        return false
      }

      const errorData = await response.json().catch(() => null)
      if (errorData?.error) {
        toast.error(errorData.error)
      }

      return false
    } catch (error) {
      console.error('Failed to save point setting:', error)
      toast.error('เกิดข้อผิดพลาด')
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
