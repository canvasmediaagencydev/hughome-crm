import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pencil } from 'lucide-react'

interface OCRData {
  ชื่อร้าน?: boolean
  ยอดรวม?: number
  วันที่?: string
  ความถูกต้อง?: number
}

interface EditReceiptModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (editedAmount: number, isValidStore: boolean) => void
  isEditing: boolean
  receiptData: {
    id: string
    total_amount: number | null
    receipt_date: string | null
    ocr_data: any
  } | null
}

export function EditReceiptModal({
  open,
  onClose,
  onConfirm,
  isEditing,
  receiptData
}: EditReceiptModalProps) {
  const [editedAmount, setEditedAmount] = useState<string>('')
  const [isValidStore, setIsValidStore] = useState<boolean>(false)

  // Initialize with receipt data when modal opens
  useEffect(() => {
    if (receiptData && open) {
      const amount = receiptData.total_amount || (receiptData.ocr_data?.ยอดรวม ?? 0)
      const validStore = receiptData.ocr_data?.ชื่อร้าน ?? false

      setEditedAmount(amount.toString())
      setIsValidStore(validStore)
    }
  }, [receiptData, open])

  const handleConfirm = () => {
    const amount = parseFloat(editedAmount) || 0
    if (amount <= 0) {
      alert('กรุณาระบุยอดเงินให้ถูกต้อง')
      return
    }
    onConfirm(amount, isValidStore)
  }

  const handleClose = () => {
    setEditedAmount('')
    setIsValidStore(false)
    onClose()
  }

  if (!receiptData) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไขยอดเงิน</DialogTitle>
          <DialogDescription>
            แก้ไขยอดเงินของใบเสร็จ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* OCR Data (if available) */}
          {receiptData.ocr_data && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium mb-1">ข้อมูลจาก OCR:</p>
              <div className="text-sm space-y-1">
                <p>ยอดรวม: {receiptData.ocr_data.ยอดรวม?.toLocaleString()} บาท</p>
                {receiptData.ocr_data.ความถูกต้อง && (
                  <p>ความแม่นยำ: {(receiptData.ocr_data.ความถูกต้อง * 100).toFixed(0)}%</p>
                )}
              </div>
            </div>
          )}

          {/* Valid Store Toggle */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="valid-store" className="text-slate-700 font-medium cursor-pointer">
                  ใบเสร็จจากร้าน "ตั้งหง่วงเซ้ง"
                </Label>
                <p className="text-xs text-slate-600 mt-1">
                  เปิดถ้าใบเสร็จนี้เป็นของร้านที่ถูกต้อง
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="valid-store"
                  checked={isValidStore}
                  onChange={(e) => setIsValidStore(e.target.checked)}
                  disabled={isEditing}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
            {isValidStore ? (
              <div className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                ✓ ใบเสร็จนี้เป็นของร้าน "ตั้งหง่วงเซ้ง"
              </div>
            ) : (
              <div className="mt-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
                ✗ ใบเสร็จนี้ไม่ใช่ของร้าน "ตั้งหง่วงเซ้ง"
              </div>
            )}
          </div>

          {/* Editable Amount */}
          <div className="space-y-2">
            <Label htmlFor="edit-amount" className="text-slate-700">ยอดเงินใหม่ (บาท) *</Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              placeholder="ระบุยอดเงิน"
              value={editedAmount}
              onChange={(e) => setEditedAmount(e.target.value)}
              disabled={isEditing}
              className="border-slate-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-lg font-semibold"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isEditing}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={isEditing || !editedAmount}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {isEditing ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
