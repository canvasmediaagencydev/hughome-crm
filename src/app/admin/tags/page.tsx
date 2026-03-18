'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Plus, Pencil, Trash2, Tag as TagIcon, RefreshCw } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from '@/hooks/useTags'
import { axiosAdmin } from '@/lib/axios-admin'
import { Tag } from '@/types'
import { TagBadge } from '@/components/TagBadge'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6b7280', '#1e293b',
]

export default function TagsPage() {
  const router = useRouter()
  const { hasPermission, loading: authLoading } = useAdminAuth()
  const { data: tags, isLoading } = useTags()
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()

  const [showModal, setShowModal] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; tags: { name: string; action: string }[] } | null>(null)

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

  if (!hasPermission(PERMISSIONS.TAGS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการดู Tags</p>
        </div>
      </div>
    )
  }

  const canManage = hasPermission(PERMISSIONS.TAGS_MANAGE)

  const openCreateModal = () => {
    setEditingTag(null)
    setName('')
    setColor('#6366f1')
    setShowModal(true)
  }

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag)
    setName(tag.name)
    setColor(tag.color)
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!name.trim()) return

    if (editingTag) {
      await updateTag.mutateAsync({ id: editingTag.id, name: name.trim(), color })
    } else {
      await createTag.mutateAsync({ name: name.trim(), color })
    }
    setShowModal(false)
  }

  const handleSyncFromLine = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data } = await axiosAdmin.post('/api/admin/tags/sync-from-line')
      setSyncResult(data)
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async (tag: Tag) => {
    if (!confirm(`ต้องการลบ Tag "${tag.name}" หรือไม่? จะลบออกจากลูกค้าทุกคนด้วย`)) return
    await deleteTag.mutateAsync(tag.id)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">จัดการ Tags</h1>
            <p className="text-sm text-slate-500 mt-1">แบ่งกลุ่มลูกค้าด้วย Tags</p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              {/* <button
                onClick={handleSyncFromLine}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'กำลัง Sync...' : 'Sync จาก LINE'}
              </button> */}
              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                สร้าง Tag
              </button>
            </div>
          )}
        </div>

        {/* Sync Result */}
        {syncResult && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-1">
              Sync สำเร็จ — {syncResult.synced} audiences จาก LINE OA
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {syncResult.tags.map((t) => (
                <span
                  key={t.name}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-white border border-green-200 text-green-700"
                >
                  {t.name}
                  <span className="text-green-500">
                    {t.action === 'imported' ? '+ นำเข้า' : t.action === 'linked' ? '✓ เชื่อม' : '+ สร้าง Audience'}
                  </span>
                </span>
              ))}
            </div>
            <button
              onClick={() => setSyncResult(null)}
              className="mt-2 text-xs text-green-600 hover:text-green-800"
            >
              ปิด
            </button>
          </div>
        )}

        {/* Tags Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
              <p className="text-slate-500">กำลังโหลด...</p>
            </div>
          ) : !tags || tags.length === 0 ? (
            <div className="text-center py-12">
              <TagIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">ยังไม่มี Tag</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tag</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">จำนวนลูกค้า</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">สร้างเมื่อ</th>
                  {canManage && (
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">จัดการ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tags.map((tag) => (
                  <tr key={tag.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <TagBadge tag={tag} size="md" />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => router.push(`/admin/users?tag=${tag.id}`)}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium transition-colors"
                      >
                        {tag.user_count || 0} คน
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(tag.created_at).toLocaleDateString('th-TH')}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(tag)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="แก้ไข"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tag)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingTag ? 'แก้ไข Tag' : 'สร้าง Tag ใหม่'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ Tag</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น VIP, กรุงเทพ, แคมเปญ 2026"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">สี</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        color === c ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <span className="text-xs text-slate-500">หรือเลือกสีเอง</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ตัวอย่าง</label>
                <TagBadge tag={{ id: '', name: name || 'ตัวอย่าง', color, created_at: '', created_by: null }} size="md" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors font-medium"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={!name.trim() || createTag.isPending || updateTag.isPending}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTag.isPending || updateTag.isPending ? 'กำลังบันทึก...' : editingTag ? 'บันทึก' : 'สร้าง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
