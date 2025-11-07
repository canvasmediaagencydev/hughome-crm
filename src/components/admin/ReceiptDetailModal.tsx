import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { Tables } from '../../../database.types'
import { getReceiptImageUrl } from '@/lib/supabase-storage'

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

interface ReceiptDetailModalProps {
  open: boolean
  onClose: () => void
  receipt: ReceiptWithRelations | null
  onImageClick: (imageUrl: string) => void
  onReprocess?: (receiptId: string) => Promise<void>
  canReprocess?: boolean
  isReprocessing?: boolean
}

export function ReceiptDetailModal({
  open,
  onClose,
  receipt,
  onImageClick,
  onReprocess,
  canReprocess = false,
  isReprocessing = false
}: ReceiptDetailModalProps) {
  if (!receipt) return null

  const handleReprocess = async () => {
    console.log('ReceiptDetailModal: Re-check button clicked', {
      hasOnReprocess: !!onReprocess,
      receiptId: receipt.id,
      isReprocessing
    })

    if (onReprocess && receipt.id) {
      try {
        await onReprocess(receipt.id)
      } catch (error) {
        console.error('ReceiptDetailModal: Reprocess error', error)
      }
    } else {
      console.warn('ReceiptDetailModal: Cannot reprocess - missing handler or receipt ID')
    }
  }

  // Format OCR timestamp
  const formatOcrTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'ไม่มีข้อมูล'
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'ไม่ถูกต้อง'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>รายละเอียดใบเสร็จ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Receipt Image */}
          {receipt.receipt_images?.[0] && (
            <div className="space-y-2">
              <strong className="text-sm text-slate-700">รูปใบเสร็จ:</strong>
              <div className="relative w-full max-w-md mx-auto">
                <div
                  className="relative w-full h-64 border border-slate-300 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    const imageUrl = getReceiptImageUrl(receipt.receipt_images[0].file_path)
                    onImageClick(imageUrl)
                  }}
                >
                  <Image
                    src={getReceiptImageUrl(receipt.receipt_images[0].file_path)}
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
                  <div className="hidden absolute inset-0 bg-slate-100 flex items-center justify-center text-sm text-slate-500">
                    ไม่สามารถโหลดรูปใบเสร็จได้
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center mt-1">
                  คลิกเพื่อดูรูปขนาดใหญ่
                </p>
              </div>
            </div>
          )}

          {/* OCR Data */}
          {receipt.ocr_data && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <strong className="text-slate-900">ข้อมูล OCR:</strong>
                  <p className="text-xs text-slate-500 mt-1">
                    ประมวลผลเมื่อ: {formatOcrTimestamp(receipt.ocr_processed_at)}
                  </p>
                </div>
                {canReprocess && receipt.status === 'pending' && (
                  <Button
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                    size="sm"
                    variant="outline"
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-300"
                  >
                    {isReprocessing ? 'กำลังตรวจสอบ...' : 'Re-check with AI'}
                  </Button>
                )}
              </div>
              <pre className="bg-slate-50 border border-slate-200 p-3 rounded text-xs overflow-auto max-h-32 text-slate-700">
                {JSON.stringify(receipt.ocr_data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300">
              ปิด
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
