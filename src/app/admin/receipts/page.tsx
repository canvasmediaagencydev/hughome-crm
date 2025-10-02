'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Receipt, ChevronLeft, ChevronRight } from 'lucide-react'
import { ReceiptWithRelations } from '@/types'
import { getReceiptImageUrl } from '@/lib/supabase-storage'
import { useReceipts } from '@/hooks/useReceipts'
import { useReceiptActions } from '@/hooks/useReceiptActions'
import { usePointCalculation } from '@/hooks/usePointCalculation'
import { ReceiptCard } from '@/components/admin/receipts/ReceiptCard'
import { FilterSection } from '@/components/admin/receipts/FilterSection'
import { AutoActionCards } from '@/components/admin/receipts/AutoActionCards'
import { AutoApproveConfirmModal } from '@/components/admin/AutoApproveConfirmModal'
import { AutoRejectConfirmModal } from '@/components/admin/AutoRejectConfirmModal'
import { ReceiptDetailModal } from '@/components/admin/ReceiptDetailModal'
import { ReceiptImageModal } from '@/components/admin/ReceiptImageModal'
import { RejectReceiptModal } from '@/components/admin/RejectReceiptModal'

export default function AdminReceipts() {
  // Modal states
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithRelations | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showAutoApproveModal, setShowAutoApproveModal] = useState(false)
  const [showAutoRejectModal, setShowAutoRejectModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [receiptToReject, setReceiptToReject] = useState<ReceiptWithRelations | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Receipt Review</h1>
        <p className="text-gray-600">ตรวจสอบและอนุมัติใบเสร็จที่ผู้ใช้อัปโหลด</p>
      </div>

      {/* Auto Approve & Reject Section */}
      {status === 'pending' && (
        <AutoActionCards
          autoApproving={autoApproving}
          autoRejecting={autoRejecting}
          loading={loading}
          onAutoApprove={handleAutoApprove}
          onAutoReject={handleAutoReject}
        />
      )}

      {/* Filters */}
      <Card className="pt-3">
        <CardContent>
          <FilterSection
            search={search}
            status={status}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onSearch={handleSearch}
          />
        </CardContent>
      </Card>

      {/* Receipt List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Receipt className="mr-2 h-5 w-5" />
              รายการใบเสร็จ
            </div>
            <Badge variant="outline">
              ทั้งหมด {pagination.total} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
              <p className="text-gray-500">กำลังโหลด...</p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">ไม่พบใบเสร็จ</p>
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
                    onApprove={handleApprove}
                    onReject={handleReject}
                    processing={processing === receipt.id}
                  />
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-600">
                แสดง {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total} รายการ
              </p>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="px-3 py-1 text-sm">
                  หน้า {pagination.page} / {pagination.totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
      />

      <ReceiptImageModal
        open={showImageModal}
        onClose={closeImageModal}
        imageUrl={selectedImageUrl}
      />
    </div>
  )
}
