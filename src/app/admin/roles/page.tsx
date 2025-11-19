'use client'

import { useEffect, useState } from 'react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import type { AdminRoleWithStats, AdminPermission } from '@/types/admin'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, ShieldCheck, Users, Key } from 'lucide-react'
import { toast } from 'sonner'

export default function RolesPage() {
  const { hasPermission, isSuperAdmin, loading: authLoading } = useAdminAuth()
  const [roles, setRoles] = useState<AdminRoleWithStats[]>([])
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [permissionsByCategory, setPermissionsByCategory] = useState<
    Record<string, AdminPermission[]>
  >({})
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AdminRoleWithStats | null>(null)

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    permission_ids: [] as string[],
  })

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

  // ตรวจสอบ permission
  if (!hasPermission(PERMISSIONS.ADMINS_MANAGE)) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </p>
        </Card>
      </div>
    )
  }

  // โหลดข้อมูล
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Get session token
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const authHeaders = {
        Authorization: `Bearer ${session.access_token}`,
      }

      // โหลด roles
      const rolesRes = await fetch('/api/admin/roles', {
        headers: authHeaders,
      })
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json()
        setRoles(rolesData.roles || [])
      }

      // โหลด permissions
      const permsRes = await fetch('/api/admin/permissions', {
        headers: authHeaders,
      })
      if (permsRes.ok) {
        const permsData = await permsRes.json()
        setPermissions(permsData.permissions || [])
        setPermissionsByCategory(permsData.grouped || {})
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = async () => {
    try {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success('สร้าง Role สำเร็จ')
        setCreateDialogOpen(false)
        resetForm()
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      console.error('Error creating role:', error)
      toast.error('เกิดข้อผิดพลาดในการสร้าง Role')
    }
  }

  const handleUpdateRole = async () => {
    if (!selectedRole) return

    try {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }

      // อัพเดท role info
      const res = await fetch(`/api/admin/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          display_name: formData.display_name,
          description: formData.description,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
        return
      }

      // อัพเดท permissions
      const permsRes = await fetch(
        `/api/admin/roles/${selectedRole.id}/permissions`,
        {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({
            permission_ids: formData.permission_ids,
          }),
        }
      )

      if (permsRes.ok) {
        toast.success('แก้ไข Role สำเร็จ')
        setEditDialogOpen(false)
        resetForm()
        loadData()
      } else {
        const error = await permsRes.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      console.error('Error updating role:', error)
      toast.error('เกิดข้อผิดพลาดในการแก้ไข Role')
    }
  }

  const handleDeleteRole = async () => {
    if (!selectedRole) return

    try {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const res = await fetch(`/api/admin/roles/${selectedRole.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (res.ok) {
        toast.success('ลบ Role สำเร็จ')
        setDeleteDialogOpen(false)
        setSelectedRole(null)
        loadData()
      } else {
        const error = await res.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      console.error('Error deleting role:', error)
      toast.error('เกิดข้อผิดพลาดในการลบ Role')
    }
  }

  const openEditDialog = async (role: AdminRoleWithStats) => {
    setSelectedRole(role)

    // โหลด permissions ของ role นี้
    try {
      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        return
      }

      const res = await fetch(`/api/admin/roles/${role.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (res.ok) {
        const data = await res.json()
        const rolePerms = data.role.permissions || []

        setFormData({
          name: role.name,
          display_name: role.display_name,
          description: role.description || '',
          permission_ids: rolePerms.map((p: AdminPermission) => p.id),
        })
        setEditDialogOpen(true)
      }
    } catch (error) {
      console.error('Error loading role permissions:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permission_ids: [],
    })
    setSelectedRole(null)
  }

  const togglePermission = (permId: string) => {
    setFormData((prev) => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter((id) => id !== permId)
        : [...prev.permission_ids, permId],
    }))
  }

  const toggleCategoryPermissions = (category: string, checked: boolean) => {
    const categoryPerms = permissionsByCategory[category] || []
    const categoryPermIds = categoryPerms.map((p) => p.id)

    setFormData((prev) => ({
      ...prev,
      permission_ids: checked
        ? [...new Set([...prev.permission_ids, ...categoryPermIds])]
        : prev.permission_ids.filter((id) => !categoryPermIds.includes(id)),
    }))
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">จัดการ Role</h1>
          <p className="text-muted-foreground">
            สร้างและจัดการ roles พร้อม permissions
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          สร้าง Role ใหม่
        </Button>
      </div>

      {/* Roles Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ Role</TableHead>
              <TableHead>คำอธิบาย</TableHead>
              <TableHead className="text-center">
                <Key className="h-4 w-4 inline mr-1" />
                Permissions
              </TableHead>
              <TableHead className="text-center">
                <Users className="h-4 w-4 inline mr-1" />
                Admins
              </TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {role.is_system && (
                      <ShieldCheck className="h-4 w-4 text-blue-500" />
                    )}
                    <span>{role.display_name}</span>
                    {role.is_system && (
                      <Badge variant="outline" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-md">
                  {role.description || '-'}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{role.permission_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{role.user_count}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(role)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRole(role)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={role.user_count > 0}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>สร้าง Role ใหม่</DialogTitle>
            <DialogDescription>
              กำหนดชื่อและเลือก permissions สำหรับ role ใหม่
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ Role (snake_case)*</Label>
              <Input
                id="name"
                placeholder="receipt_manager"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">ชื่อแสดง*</Label>
              <Input
                id="display_name"
                placeholder="Receipt Manager"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Textarea
                id="description"
                placeholder="จัดการใบเสร็จและการอนุมัติ"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              {Object.entries(permissionsByCategory).map(
                ([category, perms]) => {
                  const allChecked = perms.every((p) =>
                    formData.permission_ids.includes(p.id)
                  )
                  const someChecked = perms.some((p) =>
                    formData.permission_ids.includes(p.id)
                  )

                  return (
                    <div key={category} className="space-y-2 border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={(checked) =>
                            toggleCategoryPermissions(
                              category,
                              checked === true
                            )
                          }
                        />
                        <Label className="font-semibold text-sm uppercase">
                          {category}
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          {perms.length}
                        </Badge>
                      </div>
                      <div className="pl-6 space-y-2">
                        {perms.map((perm) => (
                          <div key={perm.id} className="flex items-start gap-2">
                            <Checkbox
                              checked={formData.permission_ids.includes(
                                perm.id
                              )}
                              onCheckedChange={() => togglePermission(perm.id)}
                            />
                            <div className="grid gap-0.5">
                              <Label className="text-sm font-normal">
                                {perm.display_name}
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {perm.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false)
                resetForm()
              }}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleCreateRole}>สร้าง Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไข Role</DialogTitle>
            <DialogDescription>
              {selectedRole?.is_system
                ? 'แก้ไขคำอธิบาย (System role ไม่สามารถแก้ไขชื่อและ permissions ได้)'
                : 'แก้ไขข้อมูลและ permissions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_display_name">ชื่อแสดง</Label>
              <Input
                id="edit_display_name"
                value={formData.display_name}
                onChange={(e) =>
                  setFormData({ ...formData, display_name: e.target.value })
                }
                disabled={selectedRole?.is_system}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">คำอธิบาย</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {!selectedRole?.is_system && (
              <div className="space-y-3">
                <Label>Permissions</Label>
                {Object.entries(permissionsByCategory).map(
                  ([category, perms]) => {
                    const allChecked = perms.every((p) =>
                      formData.permission_ids.includes(p.id)
                    )

                    return (
                      <div key={category} className="space-y-2 border rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allChecked}
                            onCheckedChange={(checked) =>
                              toggleCategoryPermissions(
                                category,
                                checked === true
                              )
                            }
                          />
                          <Label className="font-semibold text-sm uppercase">
                            {category}
                          </Label>
                          <Badge variant="outline" className="text-xs">
                            {perms.length}
                          </Badge>
                        </div>
                        <div className="pl-6 space-y-2">
                          {perms.map((perm) => (
                            <div
                              key={perm.id}
                              className="flex items-start gap-2"
                            >
                              <Checkbox
                                checked={formData.permission_ids.includes(
                                  perm.id
                                )}
                                onCheckedChange={() =>
                                  togglePermission(perm.id)
                                }
                              />
                              <div className="grid gap-0.5">
                                <Label className="text-sm font-normal">
                                  {perm.display_name}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {perm.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false)
                resetForm()
              }}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateRole}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบ Role</DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ว่าต้องการลบ role "{selectedRole?.display_name}"?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setSelectedRole(null)
              }}
            >
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole}>
              ลบ Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
