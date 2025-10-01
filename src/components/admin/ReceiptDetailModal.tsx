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
}

export function ReceiptDetailModal({
  open,
  onClose,
  receipt,
  onImageClick
}: ReceiptDetailModalProps) {
  if (!receipt) return null

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
              <strong className="text-sm">รูปใบเสร็จ:</strong>
              <div className="relative w-full max-w-md mx-auto">
                <div
                  className="relative w-full h-64 border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
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

          {/* OCR Data */}
          {receipt.ocr_data && (
            <div>
              <strong>ข้อมูล OCR:</strong>
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-32">
                {JSON.stringify(receipt.ocr_data, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              ปิด
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
