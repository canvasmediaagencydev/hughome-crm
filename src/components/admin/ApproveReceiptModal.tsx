import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle } from 'lucide-react'

interface OCRData {
  ชื่อร้าน?: boolean
  ยอดรวม?: number
  วันที่?: string
  ความถูกต้อง?: number
}

interface ApproveReceiptModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (editedAmount: number, editedDate: string, points: number) => void
  isApproving: boolean
  receiptData: {
    id: string
    total_amount: number | null
    receipt_date: string | null
    ocr_data: OCRData | null
  } | null
}

export function ApproveReceiptModal({
  open,
  onClose,
  onConfirm,
  isApproving,
  receiptData
}: ApproveReceiptModalProps) {
  const [editedAmount, setEditedAmount] = useState<string>('')
  const [editedDate, setEditedDate] = useState<string>('')
  const [calculatedPoints, setCalculatedPoints] = useState<number>(0)

  // Initialize with receipt data when modal opens
  useEffect(() => {
    if (receiptData && open) {
      const amount = receiptData.total_amount || (receiptData.ocr_data?.ยอดรวม ?? 0)
      const date = receiptData.receipt_date || (receiptData.ocr_data?.วันที่ ?? '')

      setEditedAmount(amount.toString())
      setEditedDate(date)

      // Calculate points (100 baht = 1 point)
      const points = Math.floor(amount / 100)
      setCalculatedPoints(points)
    }
  }, [receiptData, open])

  // Recalculate points when amount changes
  useEffect(() => {
    const amount = parseFloat(editedAmount) || 0
    const points = Math.floor(amount / 100)
    setCalculatedPoints(points)
  }, [editedAmount])

  const handleConfirm = () => {
    const amount = parseFloat(editedAmount) || 0
    if (amount <= 0 || !editedDate.trim()) {
      alert('กรุณาระบุยอดเงินและวันที่ให้ถูกต้อง')
      return
    }
    onConfirm(amount, editedDate.trim(), calculatedPoints)
  }

  const handleClose = () => {
    setEditedAmount('')
    setEditedDate('')
    setCalculatedPoints(0)
    onClose()
  }

  if (!receiptData) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>อนุมัติใบเสร็จ</DialogTitle>
          <DialogDescription>
            ตรวจสอบและแก้ไขข้อมูลก่อนอนุมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* OCR Data Info */}
          {receiptData.ocr_data && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium mb-1">ข้อมูลจาก OCR:</p>
              <div className="text-sm space-y-1">
                <p>ชื่อร้าน: {receiptData.ocr_data.ชื่อร้าน ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง'}</p>
                <p>ยอดรวม: {receiptData.ocr_data.ยอดรวม?.toLocaleString()} บาท</p>
                <p>วันที่: {receiptData.ocr_data.วันที่}</p>
                {receiptData.ocr_data.ความถูกต้อง && (
                  <p>ความแม่นยำ: {(receiptData.ocr_data.ความถูกต้อง * 100).toFixed(0)}%</p>
                )}
              </div>
            </div>
          )}

          {/* Editable Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-slate-700">ยอดเงิน (บาท) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="ระบุยอดเงิน"
              value={editedAmount}
              onChange={(e) => setEditedAmount(e.target.value)}
              disabled={isApproving}
              className="border-slate-300 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            />
          </div>

          {/* Editable Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-slate-700">วันที่ (dd/mm/yyyy) *</Label>
            <Input
              id="date"
              type="text"
              placeholder="15/03/2567"
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              disabled={isApproving}
              className="border-slate-300 focus:ring-2 focus:ring-green-400 focus:border-green-400"
            />
          </div>

          {/* Calculated Points */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              <strong>คะแนนที่จะได้รับ:</strong> {calculatedPoints} คะแนน
            </p>
            <p className="text-xs text-green-600 mt-1">
              (คำนวณจาก: {parseFloat(editedAmount || '0').toLocaleString()} บาท ÷ 100 = {calculatedPoints} คะแนน)
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isApproving}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-green-600 text-white hover:bg-green-700"
              disabled={isApproving || !editedAmount || !editedDate}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isApproving ? 'กำลังอนุมัติ...' : 'ยืนยันการอนุมัติ'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
