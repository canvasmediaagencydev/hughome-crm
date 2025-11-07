import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OCRData {
  ชื่อร้าน: boolean
  ยอดรวม: number
  วันที่: string
  ความถูกต้อง: number
}

interface OcrConfirmModalProps {
  open: boolean
  onClose: () => void
  oldOcrData: OCRData | null
  newOcrData: OCRData | null
  onConfirm: () => void
  onRecheck: () => void
  isConfirming: boolean
  isRechecking: boolean
}

export function OcrConfirmModal({
  open,
  onClose,
  oldOcrData,
  newOcrData,
  onConfirm,
  onRecheck,
  isConfirming,
  isRechecking
}: OcrConfirmModalProps) {
  if (!newOcrData) return null

  const hasChanges = JSON.stringify(oldOcrData) !== JSON.stringify(newOcrData)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>ตรวจสอบผล OCR ใหม่</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Comparison Table */}
          <div className="grid grid-cols-2 gap-4">
            {/* Old OCR */}
            <div>
              <h3 className="font-semibold text-sm text-slate-700 mb-2">ข้อมูลเดิม</h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                {oldOcrData ? (
                  <>
                    <div>
                      <span className="text-xs text-slate-500">ชื่อร้าน:</span>
                      <p className="font-medium">{oldOcrData.ชื่อร้าน ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">ยอดรวม:</span>
                      <p className="font-medium">{oldOcrData.ยอดรวม.toLocaleString()} บาท</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">วันที่:</span>
                      <p className="font-medium">{oldOcrData.วันที่}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500">ความถูกต้อง:</span>
                      <p className="font-medium">{(oldOcrData.ความถูกต้อง * 100).toFixed(0)}%</p>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 text-sm">ไม่มีข้อมูล</p>
                )}
              </div>
            </div>

            {/* New OCR */}
            <div>
              <h3 className="font-semibold text-sm text-slate-700 mb-2">ข้อมูลใหม่</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div>
                  <span className="text-xs text-slate-500">ชื่อร้าน:</span>
                  <p className={`font-medium ${
                    oldOcrData?.ชื่อร้าน !== newOcrData.ชื่อร้าน ? 'text-blue-700' : ''
                  }`}>
                    {newOcrData.ชื่อร้าน ? '✓ ถูกต้อง' : '✗ ไม่ถูกต้อง'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">ยอดรวม:</span>
                  <p className={`font-medium ${
                    oldOcrData?.ยอดรวม !== newOcrData.ยอดรวม ? 'text-blue-700' : ''
                  }`}>
                    {newOcrData.ยอดรวม.toLocaleString()} บาท
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">วันที่:</span>
                  <p className={`font-medium ${
                    oldOcrData?.วันที่ !== newOcrData.วันที่ ? 'text-blue-700' : ''
                  }`}>
                    {newOcrData.วันที่}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">ความถูกต้อง:</span>
                  <p className={`font-medium ${
                    oldOcrData?.ความถูกต้อง !== newOcrData.ความถูกต้อง ? 'text-blue-700' : ''
                  }`}>
                    {(newOcrData.ความถูกต้อง * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Change Summary
          {hasChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>มีการเปลี่ยนแปลง:</strong> ข้อมูล OCR ใหม่แตกต่างจากข้อมูลเดิม
              </p>
            </div>
          )} */}

          {!hasChanges && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                <strong>ไม่มีการเปลี่ยนแปลง:</strong> ข้อมูล OCR ใหม่เหมือนกับข้อมูลเดิม
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              disabled={isConfirming || isRechecking}
              variant="outline"
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isConfirming || isRechecking}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isConfirming ? 'กำลังบันทึก...' : 'ยืนยันและบันทึก'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
