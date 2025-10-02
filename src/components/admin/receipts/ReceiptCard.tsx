import { ReceiptWithRelations } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye, Check, X, Calculator } from 'lucide-react'

interface ReceiptCardProps {
  receipt: ReceiptWithRelations
  points: number
  onViewDetail: (receipt: ReceiptWithRelations) => void
  onApprove?: (receipt: ReceiptWithRelations) => void
  onReject?: (receipt: ReceiptWithRelations) => void
  processing: boolean
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

const getStoreName = (ocrData: any): string => {
  if (!ocrData || typeof ocrData !== 'object') return 'ไม่ระบุร้าน'

  const storeField = ocrData.ชื่อร้าน || ocrData["ชื่อร้าน"]
  if (storeField === true) return 'ตั้งหง่วงเซ้ง'
  if (storeField === false) return 'ไม่ใช่ของร้าน ตั้งหง่วงเซ้ง'

  return 'ไม่ระบุร้าน'
}

export function ReceiptCard({
  receipt,
  points,
  onViewDetail,
  onApprove,
  onReject,
  processing
}: ReceiptCardProps) {
  const user = receipt.user_profiles
  const displayName = user?.display_name || user?.first_name || 'ไม่ระบุชื่อ'
  const storeName = getStoreName(receipt.ocr_data)
  const isPending = receipt.status === 'pending'

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
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
              <span className="font-medium">วันที่ใบเสร็จ : </span>
              {receipt.receipt_date
                ? new Date(receipt.receipt_date).toLocaleDateString('th-TH')
                : 'N/A'}
            </div>
            <div>
              <span className="font-medium">วันที่อัปโหลด : </span>
              {receipt.created_at
                ? new Date(receipt.created_at).toLocaleDateString('th-TH')
                : 'N/A'}
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
            onClick={() => onViewDetail(receipt)}
          >
            <Eye className="h-4 w-4" />
          </Button>

          {isPending && onApprove && onReject && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApprove(receipt)}
                disabled={processing}
                className="text-green-600 hover:text-green-700"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(receipt)}
                disabled={processing}
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
}
