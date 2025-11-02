'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminRole } from '@/types/admin'

interface CreateAdminDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function CreateAdminDialog({
  open,
  onClose,
  onSuccess,
}: CreateAdminDialogProps) {
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      fetchRoles()
      // Reset form
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setFullName('')
      setSelectedRoles([])
      setErrors({})
    }
  }, [open])

  const fetchRoles = async () => {
    try {
      setLoadingRoles(true)
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const response = await fetch('/api/admin/roles', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch roles')
      }

      const data = await response.json()
      setRoles(data.roles || [])
    } catch (error) {
      console.error('Error fetching roles:', error)
      toast.error('ไม่สามารถโหลดรายการบทบาทได้')
    } finally {
      setLoadingRoles(false)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Email validation
    if (!email) {
      newErrors.email = 'กรุณากรอกอีเมล'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    }

    // Password validation
    if (!password) {
      newErrors.password = 'กรุณากรอกรหัสผ่าน'
    } else if (password.length < 8) {
      newErrors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'กรุณายืนยันรหัสผ่าน'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'รหัสผ่านไม่ตรงกัน'
    }

    // Role validation
    if (selectedRoles.length === 0) {
      newErrors.roles = 'กรุณาเลือกบทบาทอย่างน้อย 1 รายการ'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    try {
      setLoading(true)

      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName || null,
          role_ids: selectedRoles,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create admin')
      }

      toast.success('สร้างผู้ดูแลระบบสำเร็จ')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating admin:', error)
      toast.error(error.message || 'ไม่สามารถสร้างผู้ดูแลระบบได้')
    } finally {
      setLoading(false)
    }
  }

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              เพิ่มผู้ดูแลระบบใหม่
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                อีเมล <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.email ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="admin@example.com"
                disabled={loading}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ชื่อ-นามสกุล
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="John Doe"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                รหัสผ่าน <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.password ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="••••••••"
                disabled={loading}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
              <p className="mt-1 text-xs text-slate-500">
                รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  errors.confirmPassword ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="••••••••"
                disabled={loading}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Roles */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                บทบาท <span className="text-red-500">*</span>
              </label>
              {loadingRoles ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                  {roles.map((role) => (
                    <label
                      key={role.id}
                      className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                    >
                      <Checkbox
                        checked={selectedRoles.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                        disabled={loading}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm text-slate-900">
                          {role.display_name}
                        </div>
                        {role.description && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {errors.roles && (
                <p className="mt-1 text-sm text-red-600">{errors.roles}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังสร้าง...
                  </>
                ) : (
                  'สร้างผู้ดูแลระบบ'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
