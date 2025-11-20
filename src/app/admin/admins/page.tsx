'use client'

import { useEffect, useState } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import type { AdminUser, AdminRole } from '@/types/admin'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, Ban, Shield, Users } from 'lucide-react'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import CreateAdminDialog from '@/components/admin/CreateAdminDialog'
import EditAdminRolesDialog from '@/components/admin/EditAdminRolesDialog'

interface AdminWithRoles extends AdminUser {
  roles: AdminRole[]
}

export default function AdminsPage() {
  const { hasPermission, loading: authLoading } = useAdminAuth()
  const [admins, setAdmins] = useState<AdminWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<AdminWithRoles | null>(null)

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
          <p className="text-slate-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  // Check permission
  if (!hasPermission(PERMISSIONS.ADMINS_MANAGE)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการจัดการผู้ดูแลระบบ</p>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  const fetchAdmins = async () => {
    try {
      setLoading(true)

      const response = await axiosAdmin.get('/api/admin/admins')
      setAdmins(response.data.admins || [])
    } catch (error) {
      console.error('Error fetching admins:', error)
      toast.error('ไม่สามารถโหลดข้อมูลผู้ดูแลระบบได้')
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async (adminId: string) => {
    if (!confirm('คุณต้องการปิดการใช้งานผู้ดูแลระบบคนนี้หรือไม่?')) {
      return
    }

    try {
      await axiosAdmin.delete(`/api/admin/admins/${adminId}`)
      toast.success('ปิดการใช้งานผู้ดูแลระบบสำเร็จ')
      fetchAdmins()
    } catch (error) {
      console.error('Error deactivating admin:', error)
      toast.error('ไม่สามารถปิดการใช้งานได้')
    }
  }

  const handleActivate = async (adminId: string) => {
    try {
      await axiosAdmin.put(`/api/admin/admins/${adminId}`, { is_active: true })
      toast.success('เปิดการใช้งานผู้ดูแลระบบสำเร็จ')
      fetchAdmins()
    } catch (error) {
      console.error('Error activating admin:', error)
      toast.error('ไม่สามารถเปิดการใช้งานได้')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ดูแลระบบ</h1>
            <p className="text-sm text-slate-600">จัดการผู้ดูแลระบบและมอบหมายสิทธิ์</p>
          </div>
        </div>

        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มผู้ดูแลระบบ
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">ผู้ดูแลระบบทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-900">{admins.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">ใช้งานอยู่</p>
              <p className="text-2xl font-bold text-slate-900">
                {admins.filter((a) => a.is_active).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600">ปิดการใช้งาน</p>
              <p className="text-2xl font-bold text-slate-900">
                {admins.filter((a) => !a.is_active).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">รายการผู้ดูแลระบบ</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">ยังไม่มีผู้ดูแลระบบ</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>สร้างเมื่อ</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        {admin.full_name || '-'}
                      </TableCell>
                      <TableCell>{admin.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {admin.roles.length === 0 ? (
                            <span className="text-sm text-slate-500">ไม่มีบทบาท</span>
                          ) : (
                            admin.roles.map((role) => (
                              <span
                                key={role.id}
                                className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${role.name === 'super_admin'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                  }`}
                              >
                                {role.display_name}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${admin.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {admin.is_active ? 'ใช้งานอยู่' : 'ปิดการใช้งาน'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {new Date(admin.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAdmin(admin)
                              setEditDialogOpen(true)
                            }}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            แก้ไขบทบาท
                          </Button>

                          {admin.is_active ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeactivate(admin.id)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              ปิดการใช้งาน
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleActivate(admin.id)}
                              className="text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              เปิดการใช้งาน
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Create Admin Dialog */}
      <CreateAdminDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => fetchAdmins()}
      />
      <EditAdminRolesDialog
        open={editDialogOpen}
        admin={selectedAdmin}
        onClose={() => {
          setEditDialogOpen(false)
          setSelectedAdmin(null)
        }}
        onSuccess={() => fetchAdmins()}
      />
    </div>
  )
}
