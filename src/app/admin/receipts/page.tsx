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
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ReceiptCard } from '@/components/admin/receipts/ReceiptCard'
import { FilterSection } from '@/components/admin/receipts/FilterSection'
import { AutoActionCards } from '@/components/admin/receipts/AutoActionCards'
import { AutoApproveConfirmModal } from '@/components/admin/AutoApproveConfirmModal'
import { AutoRejectConfirmModal } from '@/components/admin/AutoRejectConfirmModal'
import { ReceiptDetailModal } from '@/components/admin/ReceiptDetailModal'
import { ReceiptImageModal } from '@/components/admin/ReceiptImageModal'
import { RejectReceiptModal } from '@/components/admin/RejectReceiptModal'
import { OcrConfirmModal } from '@/components/admin/OcrConfirmModal'

export default function AdminReceipts() {
  // Permission check
  const { hasPermission } = useAdminAuth()

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
  const [isReprocessing, setIsReprocessing] = useState(false)

  // OCR Confirmation states
  const [showOcrConfirmModal, setShowOcrConfirmModal] = useState(false)
  const [newOcrData, setNewOcrData] = useState<any>(null)
  const [newOcrTimestamp, setNewOcrTimestamp] = useState<string | null>(null)
  const [isConfirmingOcr, setIsConfirmingOcr] = useState(false)

  // Use ref to track processing state to prevent race conditions
  const isProcessingRef = useRef(false)

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

  const handleReprocess = useCallback(async (receiptId: string) => {
    console.log('AdminReceipts: handleReprocess called', {
      receiptId,
      isProcessingRef: isProcessingRef.current,
      timestamp: new Date().toISOString()
    })

    // Prevent multiple concurrent requests using ref (more reliable than state)
    if (isProcessingRef.current) {
      console.log('AdminReceipts: Already reprocessing (ref check), ignoring request')
      alert('กรุณารอจนกว่าการตรวจสอบปัจจุบันจะเสร็จสิ้น')
      return
    }

    console.log('AdminReceipts: Setting isProcessingRef to true')
    isProcessingRef.current = true
    setIsReprocessing(true)
    try {
      // Get current session token
      const { data: { session } } = await supabaseAdmin.auth.getSession()
      console.log('AdminReceipts: Got session', { hasSession: !!session, hasToken: !!session?.access_token })

      if (!session?.access_token) {
        throw new Error('No active session')
      }

      console.log('AdminReceipts: Calling reprocess API for receipt', receiptId)

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('AdminReceipts: Request timeout - aborting')
        controller.abort()
      }, 60000) // 60 second timeout

      const response = await fetch(`/api/admin/receipts/${receiptId}/reprocess`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      console.log('AdminReceipts: API response', { status: response.status, ok: response.ok })
      const data = await response.json()
      console.log('AdminReceipts: API data', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reprocess receipt')
      }

      // Store new OCR data and show confirmation modal
      setNewOcrData(data.ocr_data)
      setNewOcrTimestamp(data.ocr_processed_at)
      setShowOcrConfirmModal(true)
      console.log('AdminReceipts: Showing OCR confirm modal')

    } catch (error) {
      console.error('AdminReceipts: Reprocess error:', error)

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert('การตรวจสอบใบเสร็จใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง')
        } else {
          alert(error.message)
        }
      } else {
        alert('ไม่สามารถตรวจสอบใบเสร็จใหม่ได้')
      }
    } finally {
      console.log('AdminReceipts: Setting isProcessingRef to false')
      isProcessingRef.current = false
      setIsReprocessing(false)
      console.log('AdminReceipts: Reprocess finished')
    }
  }, [])

  const handleConfirmOcr = async () => {
    if (!selectedReceipt || !newOcrData) return

    setIsConfirmingOcr(true)
    try {
      // Get current session token
      const { data: { session } } = await supabaseAdmin.auth.getSession()
      if (!session?.access_token) {
        throw new Error('No active session')
      }

      const response = await fetch(`/api/admin/receipts/${selectedReceipt.id}/confirm-ocr`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ocr_data: newOcrData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm OCR data')
      }

      // Success - close modal and refresh
      alert('บันทึกข้อมูล OCR ใหม่เรียบร้อยแล้ว')
      setShowOcrConfirmModal(false)
      setNewOcrData(null)
      setNewOcrTimestamp(null)

      // Refresh receipts
      await refreshReceipts()

      // Update selected receipt
      const updatedReceipt = receipts.find(r => r.id === selectedReceipt.id)
      if (updatedReceipt) {
        setSelectedReceipt({
          ...updatedReceipt,
          ocr_data: data.ocr_data
        })
      }
    } catch (error) {
      console.error('Confirm OCR error:', error)
      alert(error instanceof Error ? error.message : 'ไม่สามารถบันทึกข้อมูล OCR ได้')
    } finally {
      setIsConfirmingOcr(false)
    }
  }

  const handleCloseOcrConfirm = () => {
    setShowOcrConfirmModal(false)
    setNewOcrData(null)
    setNewOcrTimestamp(null)
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
        onReprocess={handleReprocess}
        canReprocess={canApprove}
        isReprocessing={isReprocessing}
      />

      <ReceiptImageModal
        open={showImageModal}
        onClose={closeImageModal}
        imageUrl={selectedImageUrl}
      />

      <OcrConfirmModal
        open={showOcrConfirmModal}
        onClose={handleCloseOcrConfirm}
        oldOcrData={selectedReceipt?.ocr_data as any}
        newOcrData={newOcrData}
        onConfirm={handleConfirmOcr}
        onRecheck={() => {
          if (selectedReceipt) {
            handleCloseOcrConfirm()
            handleReprocess(selectedReceipt.id)
          }
        }}
        isConfirming={isConfirmingOcr}
        isRechecking={isReprocessing}
      />
    </div>
  )
}
