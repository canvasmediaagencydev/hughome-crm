'use client'

import { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Receipt, ChevronLeft, ChevronRight, Shield } from 'lucide-react'
import { ReceiptWithRelations } from '@/types'
import { getReceiptImageUrl } from '@/lib/supabase-storage'
import { useReceipts } from '@/hooks/useReceipts'
import { useReceiptActions } from '@/hooks/useReceiptActions'
import { usePointCalculation } from '@/hooks/usePointCalculation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { axiosAdmin } from '@/lib/axios-admin'
import { ReceiptCard } from '@/components/admin/receipts/ReceiptCard'
import { FilterSection } from '@/components/admin/receipts/FilterSection'
import { AutoActionCards } from '@/components/admin/receipts/AutoActionCards'
import { AutoApproveConfirmModal } from '@/components/admin/AutoApproveConfirmModal'
import { AutoRejectConfirmModal } from '@/components/admin/AutoRejectConfirmModal'
import { ReceiptDetailModal } from '@/components/admin/ReceiptDetailModal'
import { ReceiptImageModal } from '@/components/admin/ReceiptImageModal'
import { RejectReceiptModal } from '@/components/admin/RejectReceiptModal'
import { EditReceiptModal } from '@/components/admin/EditReceiptModal'

export default function AdminReceipts() {
  // Permission check
  const { hasPermission, loading: authLoading } = useAdminAuth()

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

  // ตรวจสอบว่ามีสิทธิ์ดูหน้านี้หรือไม่
  if (!hasPermission(PERMISSIONS.RECEIPTS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการดูใบเสร็จ</p>
        </div>
      </div>
    )
  }

  // Permission flags
  const canApprove = hasPermission(PERMISSIONS.RECEIPTS_APPROVE)
  const canReject = hasPermission(PERMISSIONS.RECEIPTS_REJECT)
  const canAutoProcess = hasPermission(PERMISSIONS.RECEIPTS_AUTO_PROCESS)
  // Modal states
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithRelations | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showAutoApproveModal, setShowAutoApproveModal] = useState(false)
  const [showAutoRejectModal, setShowAutoRejectModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [receiptToReject, setReceiptToReject] = useState<ReceiptWithRelations | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [receiptToEdit, setReceiptToEdit] = useState<ReceiptWithRelations | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Custom hooks
  const {
    receipts,
    loading,
    status,
    search,
    page,
    pagination,
    setSearch,
    setStatus,
    setPage,
    handleSearch,
    refreshReceipts
  } = useReceipts()

  const {
    processing,
    autoApproving,
    autoRejecting,
    approveReceipt,
    rejectReceipt,
    autoApproveReceipts,
    autoRejectReceipts
  } = useReceiptActions(refreshReceipts)

  const { calculatePoints } = usePointCalculation()

  // Event handlers
  const openDetailModal = (receipt: ReceiptWithRelations) => {
    setSelectedReceipt(receipt)
    setShowDetailModal(true)
  }

  const openImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl)
    setShowDetailModal(false)
    setShowImageModal(true)
  }

  const closeDetailModal = () => {
    setSelectedReceipt(null)
    setShowDetailModal(false)
  }

  const closeImageModal = () => {
    setSelectedImageUrl('')
    setShowImageModal(false)
    // กลับไปเปิด DetailModal อีกครั้ง
    setShowDetailModal(true)
  }

  const closeAutoApproveModal = () => {
    setShowAutoApproveModal(false)
  }

  const closeAutoRejectModal = () => {
    setShowAutoRejectModal(false)
  }

  const closeRejectModal = () => {
    setShowRejectModal(false)
    setReceiptToReject(null)
  }

  const handleApprove = async (receipt: ReceiptWithRelations) => {
    const points = receipt.total_amount ? calculatePoints(receipt.total_amount) : 0
    await approveReceipt(receipt, points)
  }

  const handleReject = (receipt: ReceiptWithRelations) => {
    setReceiptToReject(receipt)
    setShowRejectModal(true)
  }

  const confirmReject = async (reason: string) => {
    if (!receiptToReject) return
    await rejectReceipt(receiptToReject.id, reason)
    closeRejectModal()
  }

  const handleAutoApprove = () => {
    setShowAutoApproveModal(true)
  }

  const confirmAutoApprove = async () => {
    closeAutoApproveModal()
    await autoApproveReceipts()
  }

  const handleAutoReject = () => {
    setShowAutoRejectModal(true)
  }

  const confirmAutoReject = async () => {
    closeAutoRejectModal()
    await autoRejectReceipts()
  }

  const handleEditAmount = (receiptId: string) => {
    const receipt = receipts.find(r => r.id === receiptId)
    if (receipt) {
      setReceiptToEdit(receipt)
      setShowEditModal(true)
    }
  }

  const confirmEditAmount = async (editedAmount: number, isValidStore: boolean) => {
    if (!receiptToEdit) return

    setIsEditing(true)
    try {

      await axiosAdmin.put(`/api/admin/receipts/${receiptToEdit.id}/edit-amount`, {
        total_amount: editedAmount,
        is_valid_store: isValidStore
      })

      alert('แก้ไขเรียบร้อยแล้ว')
      setShowEditModal(false)
      setReceiptToEdit(null)

      // Refresh receipts
      await refreshReceipts()

      // Update selected receipt if it's the same one
      if (selectedReceipt?.id === receiptToEdit.id) {
        const currentOcrData = (selectedReceipt.ocr_data || {}) as any
        const updatedOcrData = {
          ...currentOcrData,
          ชื่อร้าน: isValidStore
        }
        setSelectedReceipt({
          ...selectedReceipt,
          total_amount: editedAmount,
          ocr_data: updatedOcrData
        })
      }
    } catch (error: any) {
      console.error('Edit amount error:', error)
      alert(error.response?.data?.error || 'ไม่สามารถแก้ไขยอดเงินได้')
    } finally {
      setIsEditing(false)
    }
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setReceiptToEdit(null)
  }


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 shadow-sm">
          <FilterSection
            search={search}
            status={status}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onSearch={handleSearch}
          />
        </div>

        {/* Auto Actions - แสดงเฉพาะถ้ามี auto_process permission */}
        {status === 'pending' && canAutoProcess && (
          <AutoActionCards
            autoApproving={autoApproving}
            autoRejecting={autoRejecting}
            loading={loading}
            onAutoApprove={handleAutoApprove}
            onAutoReject={handleAutoReject}
          />
        )}

        {/* Receipt List */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Receipt className="mr-2 h-5 w-5 text-slate-400" />
                <h2 className="font-semibold text-slate-900">รายการใบเสร็จ</h2>
              </div>
              <Badge variant="outline" className="text-slate-700 border-slate-200">
                ทั้งหมด {pagination.total} รายการ
              </Badge>
            </div>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
                <p className="text-slate-500">กำลังโหลด...</p>
              </div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">ไม่พบใบเสร็จ</p>
              </div>
            ) : (
              <div className="space-y-4">
                {receipts.map((receipt) => {
                  const points = receipt.total_amount ? calculatePoints(receipt.total_amount) : 0

                  return (
                    <ReceiptCard
                      key={receipt.id}
                      receipt={receipt}
                      points={points}
                      onViewDetail={openDetailModal}
                      onApprove={canApprove ? handleApprove : undefined}
                      onReject={canReject ? handleReject : undefined}
                      processing={processing === receipt.id}
                    />
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-slate-600">
                  แสดง {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
                </p>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  <span className="px-3 py-1 text-sm text-slate-700">
                    หน้า {pagination.page} / {pagination.totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= pagination.totalPages}
                    className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AutoApproveConfirmModal
        open={showAutoApproveModal}
        onClose={closeAutoApproveModal}
        onConfirm={confirmAutoApprove}
        isApproving={autoApproving}
      />

      <AutoRejectConfirmModal
        open={showAutoRejectModal}
        onClose={closeAutoRejectModal}
        onConfirm={confirmAutoReject}
        isRejecting={autoRejecting}
      />

      <RejectReceiptModal
        open={showRejectModal}
        onClose={closeRejectModal}
        onConfirm={confirmReject}
        isRejecting={processing === receiptToReject?.id}
      />

      <ReceiptDetailModal
        open={showDetailModal}
        onClose={closeDetailModal}
        receipt={selectedReceipt}
        onImageClick={openImageModal}
        onEditAmount={handleEditAmount}
        canEdit={canApprove}
      />

      <ReceiptImageModal
        open={showImageModal}
        onClose={closeImageModal}
        imageUrl={selectedImageUrl}
      />

      <EditReceiptModal
        open={showEditModal}
        onClose={closeEditModal}
        onConfirm={confirmEditAmount}
        isEditing={isEditing}
        receiptData={receiptToEdit}
      />

    </div>
  )
}
