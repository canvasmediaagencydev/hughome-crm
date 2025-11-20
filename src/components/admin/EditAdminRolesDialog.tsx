'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Shield, X } from 'lucide-react'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import type { AdminRole, AdminUser } from '@/types/admin'

interface AdminWithRoles extends AdminUser {
  roles: AdminRole[]
}

interface EditAdminRolesDialogProps {
  admin: AdminWithRoles | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function EditAdminRolesDialog({
  admin,
  open,
  onClose,
  onSuccess,
}: EditAdminRolesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      fetchRoles()
    }
  }, [open])

  useEffect(() => {
    if (open && admin) {
      const currentRoles = admin.roles?.map((role) => role.id) ?? []
      setSelectedRoles(currentRoles)
    }
  }, [open, admin])

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true)

      const response = await axiosAdmin.get('/api/admin/roles')
      setRoles(response.data.roles || [])
    } catch (error) {
      console.error('Error fetching roles:', error)
      toast.error('ไม่สามารถโหลดรายการบทบาทได้')
    } finally {
      setLoadingRoles(false)
    }
  }

  const handleToggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!admin) return

    try {
      setLoading(true)

      await axiosAdmin.put(`/api/admin/admins/${admin.id}/roles`, {
        role_ids: selectedRoles,
      })

      toast.success('อัปเดตบทบาทผู้ดูแลระบบสำเร็จ')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error updating admin roles:', error)
      toast.error(error.message || 'ไม่สามารถอัปเดตบทบาทได้')
    } finally {
      setLoading(false)
    }
  }

  const dialogTitle = useMemo(() => {
    if (!admin) return 'แก้ไขบทบาท'
    return `แก้ไขบทบาท: ${admin.full_name || admin.email}`
  }, [admin])

  if (!open || !admin) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50 h-screen"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">{dialogTitle}</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Close edit roles dialog"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div>
              <p className="text-sm text-slate-600">
                เลือกบทบาทที่ต้องการมอบหมายให้ผู้ดูแลระบบคนนี้ สามารถเลือกได้มากกว่า 1 บทบาท
              </p>
            </div>

            {loadingRoles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Shield className="w-10 h-10 text-slate-300" />
                <p className="text-slate-600">ยังไม่มีการสร้างบทบาทในระบบ</p>
                <p className="text-xs text-slate-500">สร้างบทบาทจากหน้า "จัดการ Role" ก่อน</p>
              </div>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 hover:border-indigo-300 transition"
                  >
                    <Checkbox
                      checked={selectedRoles.includes(role.id)}
                      onCheckedChange={() => handleToggleRole(role.id)}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{role.display_name}</p>
                      <p className="text-xs text-slate-600">{role.description || 'ไม่มีคำอธิบาย'}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                บันทึกบทบาท
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
