import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface AutoRejectConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isRejecting: boolean
}

export function AutoRejectConfirmModal({
  open,
  onClose,
  onConfirm,
  isRejecting
}: AutoRejectConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ยืนยันการปฏิเสธอัตโนมัติ</DialogTitle>
          <DialogDescription>
            การดำเนินการนี้จะปฏิเสธใบเสร็จทั้งหมดที่ไม่ใช่ของร้าน "ตั้งหง่วงเซ้ง" โดยอัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <X className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div>
                <h4 className="font-medium text-slate-900 mb-1">
                  คุณต้องการปฏิเสธใบเสร็จที่ไม่ใช่ของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดโดยอัตโนมัติหรือไม่?
                </h4>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button onClick={onClose} variant="outline" disabled={isRejecting} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300">
              ยกเลิก
            </Button>
            <Button
              onClick={onConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isRejecting}
            >
              <X className="mr-2 h-4 w-4" />
              {isRejecting ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
