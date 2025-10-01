'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Receipt,
  Eye,
  Check,
  X,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Zap
} from 'lucide-react'
import { Tables } from '../../../../database.types'
import { toast } from 'sonner'
import { getReceiptImageUrl } from '@/lib/supabase-storage'
import { AutoApproveConfirmModal } from '@/components/admin/AutoApproveConfirmModal'
import { ReceiptDetailModal } from '@/components/admin/ReceiptDetailModal'
import { ReceiptImageModal } from '@/components/admin/ReceiptImageModal'
import { RejectReceiptModal } from '@/components/admin/RejectReceiptModal'

type ReceiptWithRelations = Tables<'receipts'> & {
  user_profiles: {
    id: string
    display_name: string | null
    first_name: string | null
    last_name: string | null
    line_user_id: string
  } | null
  receipt_images: {
    id: string
    file_name: string
    file_path: string
    file_size: number | null
    mime_type: string | null
  }[]
}

type PointSetting = Tables<'point_settings'>

interface ReceiptListResponse {
  receipts: ReceiptWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function AdminReceipts() {
  const [receipts, setReceipts] = useState<ReceiptWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [autoApproving, setAutoApproving] = useState(false)
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [pointSetting, setPointSetting] = useState<PointSetting | null>(null)

  // Modal states
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithRelations | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showAutoApproveModal, setShowAutoApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [receiptToReject, setReceiptToReject] = useState<ReceiptWithRelations | null>(null)
  const [selectedImageUrl, setSelectedImageUrl] = useState('')

  useEffect(() => {
    fetchReceipts()
    fetchPointSetting()
  }, [status, search, page])

  const fetchPointSetting = async () => {
    try {
      const response = await fetch('/api/admin/point-settings')
      if (response.ok) {
        const data = await response.json()
        const bahtSetting = data.find((s: PointSetting) => s.setting_key === 'baht_per_point')
        setPointSetting(bahtSetting)
      }
    } catch (error) {
      console.error('Failed to fetch point setting:', error)
    }
  }

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status,
        page: page.toString(),
        limit: '20'
      })

      if (search.trim()) {
        params.append('search', search.trim())
      }

      const response = await fetch(`/api/admin/receipts?${params}`)
      if (response.ok) {
        const data: ReceiptListResponse = await response.json()
        setReceipts(data.receipts)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
      toast.error('ไม่สามารถโหลดข้อมูลใบเสร็จได้')
    } finally {
      setLoading(false)
    }
  }

  const calculatePoints = (totalAmount: number): number => {
    if (!pointSetting || !totalAmount) return 0
    return Math.floor(totalAmount / pointSetting.setting_value)
  }

  const handleSearch = () => {
    setPage(1)
    fetchReceipts()
  }

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

  const closeRejectModal = () => {
    setShowRejectModal(false)
    setReceiptToReject(null)
  }

  const handleApprove = async (receipt: ReceiptWithRelations) => {
    const points = receipt.total_amount ? calculatePoints(receipt.total_amount) : 0

    setProcessing(receipt.id)
    try {
      const response = await fetch(`/api/admin/receipts/${receipt.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points_awarded: points,
          admin_notes: 'อนุมัติโดยระบบ'
        })
      })

      if (response.ok) {
        toast.success('อนุมัติใบเสร็จสำเร็จ!')
        fetchReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติ')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = (receipt: ReceiptWithRelations) => {
    setReceiptToReject(receipt)
    setShowRejectModal(true)
  }

  const confirmReject = async (reason: string) => {
    if (!receiptToReject) return

    setProcessing(receiptToReject.id)
    closeRejectModal()

    try {
      const response = await fetch(`/api/admin/receipts/${receiptToReject.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_notes: reason
        })
      })

      if (response.ok) {
        toast.success('ปฏิเสธใบเสร็จสำเร็จ!')
        fetchReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการปฏิเสธ')
    } finally {
      setProcessing(null)
    }
  }

  const handleAutoApprove = () => {
    setShowAutoApproveModal(true)
  }

  const confirmAutoApprove = async () => {
    setAutoApproving(true)
    closeAutoApproveModal()

    try {
      const response = await fetch('/api/admin/receipts/auto-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`อนุมัติสำเร็จ ${result.approved_count} ใบเสร็จ`)
        if (result.error_count > 0) {
          toast.warning(`มีข้อผิดพลาด ${result.error_count} รายการ`)
        }
        fetchReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติอัตโนมัติ')
    } finally {
      setAutoApproving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      processing: 'bg-blue-100 text-blue-800'
    }

    const labels = {
      pending: 'รอการอนุมัติ',
      approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธแล้ว',
      processing: 'กำลังประมวลผล'
    }

    return (
      <Badge className={styles[status as keyof typeof styles]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Receipt Review</h1>
        <p className="text-gray-600">ตรวจสอบและอนุมัติใบเสร็จที่ผู้ใช้อัปโหลด</p>
      </div>

      {/* Auto Approve Section */}
      {status === 'pending' && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center justify-between">
              <div className="flex items-center">
                <Zap className="mr-2 h-5 w-5" />
                อนุมัติอัตโนมัติ
              </div>
            </CardTitle>
            <CardDescription>
              อนุมัติใบเสร็จที่เป็นของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดในครั้งเดียว
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleAutoApprove}
              disabled={autoApproving || loading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Zap className="mr-2 h-4 w-4" />
              {autoApproving ? 'กำลังอนุมัติ...' : 'อนุมัติใบเสร็จของร้านทั้งหมด'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">ค้นหา</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="ค้นหาชื่อผู้ใช้หรือยอดเงิน..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="outline">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="status">สถานะ</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="pending">รอการอนุมัติ</option>
                <option value="approved">อนุมัติแล้ว</option>
                <option value="rejected">ปฏิเสธแล้ว</option>
                <option value="processing">กำลังประมวลผล</option>
              </select>
            </div>
          </div>
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
                const user = receipt.user_profiles
                const displayName = user?.display_name || user?.first_name || 'ไม่ระบุชื่อ'
                const points = receipt.total_amount ? calculatePoints(receipt.total_amount) : 0
                const receiptImage = receipt.receipt_images?.[0]
                const imageUrl = receiptImage ? getReceiptImageUrl(receiptImage.file_path) : null

                // Extract store name from OCR data
                const ocrData = receipt.ocr_data
                let storeName = 'ไม่ระบุร้าน'

                if (ocrData && typeof ocrData === 'object') {
                  const storeField = (ocrData as any).ชื่อร้าน || (ocrData as any)["ชื่อร้าน"]
                  if (storeField === true) {
                    storeName = 'ตั้งหง่วงเซ้ง'
                  } else if (storeField === false) {
                    storeName = 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง'
                  }
                }

                return (
                  <div key={receipt.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      {/* Receipt Details */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <p>ชื่อลูกค้า : </p>
                          <h3 className="font-medium">{displayName}</h3>
                          {getStatusBadge(receipt.status || 'pending')}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">ยอดเงิน:</span> ฿{receipt.total_amount?.toLocaleString() || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">วันที่ใบเสร็จ : </span> {
                              receipt.receipt_date
                                ? new Date(receipt.receipt_date).toLocaleDateString('th-TH')
                                : 'N/A'
                            }
                          </div>
                          <div>
                            <span className="font-medium">วันที่อัปโหลด : </span> {
                              receipt.created_at
                                ? new Date(receipt.created_at).toLocaleDateString('th-TH')
                                : 'N/A'
                            }
                          </div>
                          <div className="flex items-center">
                            <Calculator className="mr-1 h-3 w-3" />
                            <span className="font-medium">Points : </span> {points}
                          </div>
                          <div className="truncate">
                            <span className="font-medium">ร้าน:</span>
                            <span className={storeName === 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง' ? 'text-red-500 font-medium' : ''}>
                              {storeName}
                            </span>
                          </div>
                        </div>

                        {receipt.admin_notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            <strong>หมายเหตุ:</strong> {receipt.admin_notes}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetailModal(receipt)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {receipt.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleApprove(receipt)}
                              disabled={processing === receipt.id}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(receipt)}
                              disabled={processing === receipt.id}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
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
