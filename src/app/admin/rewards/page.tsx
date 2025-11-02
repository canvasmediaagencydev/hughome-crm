'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Gift, Plus, Edit, Trash2, Package, Image as ImageIcon, Shield } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { Tables } from '../../../../database.types'
import { toast } from 'sonner'
import Image from 'next/image'
import { Pagination } from '@/components/Pagination'

type Reward = Tables<'rewards'> & {
  remaining_stock?: number | null
  redeemed_count?: number
}

interface PaginationType {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminRewards() {
  const { hasPermission } = useAdminAuth()

  if (!hasPermission(PERMISSIONS.REWARDS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการดูรางวัล</p>
        </div>
      </div>
    )
  }

  const canCreate = hasPermission(PERMISSIONS.REWARDS_CREATE)
  const canEdit = hasPermission(PERMISSIONS.REWARDS_EDIT)
  const canDelete = hasPermission(PERMISSIONS.REWARDS_DELETE)

  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationType | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [deletingReward, setDeletingReward] = useState<Reward | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    points_cost: '',
    category: '',
    stock_quantity: '',
    is_active: true,
    sort_order: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    fetchRewards(currentPage)
  }, [currentPage])

  const fetchRewards = async (page: number) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/rewards?page=${page}&limit=12`)
      if (response.ok) {
        const data = await response.json()
        setRewards(data.rewards || [])
        setPagination(data.pagination)
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลรางวัลได้')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      points_cost: '',
      category: '',
      stock_quantity: '',
      is_active: true,
      sort_order: '',
    })
    setImageFile(null)
    setImagePreview(null)
    setEditingReward(null)
  }

  const handleOpenFormDialog = (reward?: Reward) => {
    if (reward) {
      setEditingReward(reward)
      setFormData({
        name: reward.name,
        description: reward.description || '',
        points_cost: reward.points_cost.toString(),
        category: reward.category || '',
        stock_quantity: reward.stock_quantity?.toString() || '',
        is_active: reward.is_active ?? true,
        sort_order: reward.sort_order?.toString() || '',
      })
      setImagePreview(reward.image_url)
    } else {
      resetForm()
    }
    setShowFormDialog(true)
  }

  const handleCloseFormDialog = () => {
    setShowFormDialog(false)
    setTimeout(resetForm, 200)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        return data.url
      }
      return null
    } catch (error) {
      console.error('Image upload error:', error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      let imageUrl = editingReward?.image_url || null

      // Upload image if new file is selected
      if (imageFile) {
        const uploadedUrl = await uploadImage(imageFile)
        if (uploadedUrl) {
          imageUrl = uploadedUrl
        } else {
          toast.error('ไม่สามารถอัปโหลดรูปภาพได้')
          setSubmitting(false)
          return
        }
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        points_cost: parseInt(formData.points_cost) || 0,
        category: formData.category,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
        is_active: formData.is_active,
        sort_order: formData.sort_order ? parseInt(formData.sort_order) : null,
        image_url: imageUrl,
      }

      let response
      if (editingReward) {
        response = await fetch(`/api/admin/rewards/${editingReward.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch('/api/admin/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (response.ok) {
        toast.success(editingReward ? 'แก้ไขรางวัลสำเร็จ' : 'เพิ่มรางวัลสำเร็จ')
        handleCloseFormDialog()
        fetchRewards(currentPage)
      } else {
        toast.error('ไม่สามารถบันทึกข้อมูลได้')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingReward) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/admin/rewards/${deletingReward.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('ลบรางวัลสำเร็จ')
        setShowDeleteDialog(false)
        setDeletingReward(null)
        fetchRewards(currentPage)
      } else {
        toast.error('ไม่สามารถลบรางวัลได้')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (reward: Reward) => {
    try {
      const response = await fetch(`/api/admin/rewards/${reward.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !reward.is_active }),
      })

      if (response.ok) {
        const updatedReward = await response.json()
        setRewards(prev => prev.map(r => r.id === reward.id ? updatedReward : r))
        toast.success('อัปเดตสถานะสำเร็จ')
      } else {
        toast.error('ไม่สามารถอัปเดตสถานะได้')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Action Bar */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-sm font-medium text-slate-600">จัดการรางวัล</h2>
              <p className="text-xs text-slate-500 mt-0.5">ทั้งหมด {pagination?.total || 0} รายการ</p>
            </div>
            <Button onClick={() => handleOpenFormDialog()} className="bg-slate-900 text-white hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มรางวัล
            </Button>
          </div>
        </div>

        {/* Rewards List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="relative inline-flex">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200"></div>
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-900 border-t-transparent absolute top-0 left-0"></div>
            </div>
            <p className="text-slate-600 mt-6 font-medium">กำลังโหลดข้อมูล...</p>
          </div>
        ) : rewards.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="py-20 text-center">
              <Gift className="mx-auto h-16 w-16 text-slate-400 mb-4" />
              <p className="text-slate-500 mb-4">ยังไม่มีรางวัลในระบบ</p>
              <Button onClick={() => handleOpenFormDialog()} className="bg-slate-900 text-white hover:bg-slate-800">
                <Plus className="mr-2 h-4 w-4" />
                เพิ่มรางวัลแรก
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
              {rewards.map((reward, index) => (
                <div
                  key={reward.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <Card className="overflow-hidden bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200">
                <div className="aspect-video bg-slate-100 relative">
                  {reward.image_url ? (
                    <Image
                      src={reward.image_url}
                      alt={reward.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-slate-400" />
                    </div>
                  )}
                  {reward.stock_quantity !== null && (
                    <div className="absolute top-2 right-2">
                      <Badge
                        className={`text-white hover:opacity-90 ${
                          reward.remaining_stock === 0
                            ? 'bg-red-500'
                            : (reward.remaining_stock !== undefined && reward.remaining_stock !== null && reward.remaining_stock < 10)
                              ? 'bg-orange-500'
                              : 'bg-slate-900'
                        }`}
                      >
                        <Package className="mr-1 h-3 w-3" />
                        {reward.remaining_stock !== undefined ? reward.remaining_stock : reward.stock_quantity} ชิ้น
                      </Badge>
                    </div>
                  )}
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg text-slate-900">{reward.name}</CardTitle>
                    <Badge
                      variant={reward.is_active ? 'default' : 'secondary'}
                      className={reward.is_active ? 'bg-green-500 hover:bg-green-600' : 'bg-slate-200 text-slate-700'}
                    >
                      {reward.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </div>
                  {reward.category && (
                    <CardDescription className="text-slate-600">{reward.category}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {reward.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {reward.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center text-blue-400 font-semibold">
                      <Gift className="mr-1 h-4 w-4" />
                      {reward.points_cost.toLocaleString()} แต้ม
                    </div>
                    <div className="flex flex-col items-end text-slate-600 text-xs">
                      {reward.stock_quantity !== null ? (
                        <>
                          <div className="flex items-center font-semibold">
                            <Package className="mr-1 h-3 w-3" />
                            สต็อก: {reward.stock_quantity} ชิ้น
                          </div>
                          {reward.redeemed_count !== undefined && reward.redeemed_count > 0 && (
                            <div className="text-slate-500">
                              (แลกไป {reward.redeemed_count} ชิ้น)
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center">
                          <Package className="mr-1 h-3 w-3" />
                          ไม่จำกัด
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor={`active-${reward.id}`} className="text-sm text-slate-700">
                        เปิดใช้งาน
                      </Label>
                      <Switch
                        id={`active-${reward.id}`}
                        checked={reward.is_active ?? true}
                        onCheckedChange={() => handleToggleActive(reward)}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenFormDialog(reward)}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDeletingReward(reward)
                          setShowDeleteDialog(true)
                        }}
                        className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
                  </Card>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={handleCloseFormDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReward ? 'แก้ไขรางวัล' : 'เพิ่มรางวัลใหม่'}
            </DialogTitle>
            <DialogDescription>
              กรอกข้อมูลรางวัลให้ครบถ้วน
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อรางวัล *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">รายละเอียด</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="points_cost">แต้มที่ใช้แลก *</Label>
                <Input
                  id="points_cost"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.points_cost}
                  onChange={(e) =>
                    setFormData({ ...formData, points_cost: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">หมวดหมู่</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">จำนวนสต็อค (เว้นว่าง = ไม่จำกัด)</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.stock_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, stock_quantity: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort_order">ลำดับการแสดง</Label>
                <Input
                  id="sort_order"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formData.sort_order}
                  onChange={(e) =>
                    setFormData({ ...formData, sort_order: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="image">รูปภาพรางวัล</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              {imagePreview && (
                <div className="mt-2 relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">เปิดใช้งานรางวัลนี้</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseFormDialog}
                disabled={submitting}
                className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={submitting} className="bg-slate-900 text-white hover:bg-slate-800">
                {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบรางวัล</DialogTitle>
            <DialogDescription>
              คุณแน่ใจหรือไม่ที่จะลบรางวัล &quot;{deletingReward?.name}&quot;?
              การกระทำนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeletingReward(null)
              }}
              disabled={submitting}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {submitting ? 'กำลังลบ...' : 'ลบรางวัล'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
