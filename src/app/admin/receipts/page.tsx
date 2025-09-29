'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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
  Calculator
} from 'lucide-react'
import { Tables } from '../../../../database.types'
import { toast } from 'sonner'
import { getReceiptImageUrl } from '@/lib/supabase-storage'
import Image from 'next/image'

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
  const [modalType, setModalType] = useState<'view' | 'approve' | 'reject' | 'image' | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [calculatedPoints, setCalculatedPoints] = useState(0)
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

  const openModal = (receipt: ReceiptWithRelations, type: 'view' | 'approve' | 'reject') => {
    setSelectedReceipt(receipt)
    setModalType(type)
    setAdminNotes('')

    if (type === 'approve' && receipt.total_amount) {
      const points = calculatePoints(receipt.total_amount)
      setCalculatedPoints(points)
    }
  }

  const openImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl)
    setModalType('image')
  }

  const closeModal = () => {
    setSelectedReceipt(null)
    setModalType(null)
    setAdminNotes('')
    setCalculatedPoints(0)
    setSelectedImageUrl('')
  }

  const handleApprove = async () => {
    if (!selectedReceipt) return

    setProcessing(selectedReceipt.id)
    try {
      const response = await fetch(`/api/admin/receipts/${selectedReceipt.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points_awarded: calculatedPoints,
          admin_notes: adminNotes.trim() || 'อนุมัติโดยระบบ'
        })
      })

      if (response.ok) {
        toast.success('อนุมัติใบเสร็จสำเร็จ!')
        closeModal()
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

  const handleReject = async () => {
    if (!selectedReceipt || !adminNotes.trim()) {
      toast.error('กรุณาระบุเหตุผลในการปฏิเสธ')
      return
    }

    setProcessing(selectedReceipt.id)
    try {
      const response = await fetch(`/api/admin/receipts/${selectedReceipt.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_notes: adminNotes.trim()
        })
      })

      if (response.ok) {
        toast.success('ปฏิเสธใบเสร็จสำเร็จ!')
        closeModal()
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

                return (
                  <div key={receipt.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start space-x-4">
                      {/* Receipt Image Thumbnail */}
                      {imageUrl && (
                        <div className="flex-shrink-0">
                          <div
                            className="w-20 h-20 relative border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => openImageModal(imageUrl)}
                          >
                            <Image
                              src={imageUrl}
                              alt="Receipt thumbnail"
                              fill
                              className="object-cover"
                              sizes="80px"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                target.nextElementSibling?.classList.remove('hidden')
                              }}
                            />
                            <div className="hidden absolute inset-0 bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                              ไม่สามารถโหลดรูป
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Receipt Details */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium">{displayName}</h3>
                          {getStatusBadge(receipt.status || 'pending')}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">ยอดเงิน:</span> ฿{receipt.total_amount?.toLocaleString() || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">วันที่:</span> {
                              receipt.receipt_date
                                ? new Date(receipt.receipt_date).toLocaleDateString('th-TH')
                                : 'N/A'
                            }
                          </div>
                          <div className="flex items-center">
                            <Calculator className="mr-1 h-3 w-3" />
                            <span className="font-medium">Points:</span> {points}
                          </div>
                        </div>

                        {receipt.admin_notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            <strong>หมายเหตุ:</strong> {receipt.admin_notes}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openModal(receipt, 'view')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {receipt.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModal(receipt, 'approve')}
                              disabled={processing === receipt.id}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openModal(receipt, 'reject')}
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
      <Dialog open={!!modalType} onOpenChange={closeModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modalType === 'view' && 'รายละเอียดใบเสร็จ'}
              {modalType === 'approve' && 'อนุมัติใบเสร็จ'}
              {modalType === 'reject' && 'ปฏิเสธใบเสร็จ'}
            </DialogTitle>
          </DialogHeader>

          {modalType === 'image' && selectedImageUrl && (
            <div className="space-y-4">
              <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg">
                <Image
                  src={selectedImageUrl}
                  alt="Receipt full size"
                  width={800}
                  height={600}
                  className="w-full h-auto object-contain"
                  sizes="(max-width: 768px) 100vw, 800px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/placeholder-receipt.png'
                  }}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={closeModal} variant="outline">
                  ปิด
                </Button>
              </div>
            </div>
          )}

          {selectedReceipt && modalType !== 'image' && (
            <div className="space-y-4">
              {/* Receipt Image */}
              {selectedReceipt.receipt_images?.[0] && (
                <div className="space-y-2">
                  <strong className="text-sm">รูปใบเสร็จ:</strong>
                  <div className="relative w-full max-w-md mx-auto">
                    <div
                      className="relative w-full h-64 border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        const imageUrl = getReceiptImageUrl(selectedReceipt.receipt_images[0].file_path)
                        openImageModal(imageUrl)
                      }}
                    >
                      <Image
                        src={getReceiptImageUrl(selectedReceipt.receipt_images[0].file_path)}
                        alt="Receipt image"
                        fill
                        className="object-cover"
                        sizes="384px"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          target.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                      <div className="hidden absolute inset-0 bg-gray-200 flex items-center justify-center text-sm text-gray-500">
                        ไม่สามารถโหลดรูปใบเสร็จได้
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      คลิกเพื่อดูรูปขนาดใหญ่
                    </p>
                  </div>
                </div>
              )}

              {/* Receipt Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>ผู้ใช้:</strong> {selectedReceipt.user_profiles?.display_name || 'ไม่ระบุ'}
                </div>
                <div>
                  <strong>ยอดเงิน:</strong> ฿{selectedReceipt.total_amount?.toLocaleString() || 'N/A'}
                </div>
                <div>
                  <strong>วันที่:</strong> {
                    selectedReceipt.receipt_date
                      ? new Date(selectedReceipt.receipt_date).toLocaleDateString('th-TH')
                      : 'N/A'
                  }
                </div>
                <div>
                  <strong>สถานะ:</strong> {getStatusBadge(selectedReceipt.status || 'pending')}
                </div>
              </div>

              {/* OCR Data */}
              {selectedReceipt.ocr_data && (
                <div>
                  <strong>ข้อมูล OCR:</strong>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedReceipt.ocr_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions for approve/reject */}
              {modalType === 'approve' && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2">การคำนวณ Points</h4>
                    <div className="text-sm text-green-700">
                      <p>ยอดเงิน: ฿{selectedReceipt.total_amount?.toLocaleString()}</p>
                      <p>อัตราแลกเปลี่ยน: ฿{pointSetting?.setting_value} = 1 Point</p>
                      <p className="font-medium">Points ที่จะได้รับ: {calculatedPoints} Points</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="approve-notes">หมายเหตุ (ไม่บังคับ)</Label>
                    <Input
                      id="approve-notes"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="เพิ่มหมายเหตุ..."
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button onClick={closeModal} variant="outline">
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={handleApprove}
                      disabled={!!processing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing ? 'กำลังประมวลผล...' : 'อนุมัติ'}
                    </Button>
                  </div>
                </div>
              )}

              {modalType === 'reject' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reject-notes">เหตุผลในการปฏิเสธ *</Label>
                    <Input
                      id="reject-notes"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="ระบุเหตุผล..."
                      required
                    />
                  </div>

                  <div className="flex space-x-2">
                    <Button onClick={closeModal} variant="outline">
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={!!processing || !adminNotes.trim()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {processing ? 'กำลังประมวลผล...' : 'ปฏิเสธ'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}