import { useState, useCallback } from 'react'
import { axiosAdmin as axios } from '@/lib/axios-admin'
import { toast } from 'sonner'

export function useUserRole(initialRole: 'contractor' | 'homeowner' = 'contractor') {
  const [newRole, setNewRole] = useState<'contractor' | 'homeowner'>(initialRole)
  const [processingRole, setProcessingRole] = useState(false)

  const changeRole = useCallback(async (
    userId: string,
    onSuccess?: () => void
  ) => {
    try {
      setProcessingRole(true)
      await axios.patch(`/api/admin/users/${userId}/role`, {
        role: newRole
      })

      toast.success('เปลี่ยน Role สำเร็จ')
      onSuccess?.()
      return true
    } catch (error: any) {
      console.error('Error changing role:', error)
      toast.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการเปลี่ยน Role')
      return false
    } finally {
      setProcessingRole(false)
    }
  }, [newRole])

  return {
    newRole,
    setNewRole,
    processingRole,
    changeRole
  }
}
