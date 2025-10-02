import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

interface AutoApproveConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isApproving: boolean
}

export function AutoApproveConfirmModal({
  open,
  onClose,
  onConfirm,
  isApproving
}: AutoApproveConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ยืนยันการอนุมัติอัตโนมัติ</DialogTitle>
          <DialogDescription>
            การดำเนินการนี้จะอนุมัติใบเสร็จทั้งหมดที่เป็นของร้าน "ตั้งหง่วงเซ้ง" โดยอัตโนมัติ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Zap className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
              <div>
                <h4 className="font-medium text-slate-900 mb-1">
                  คุณต้องการอนุมัติใบเสร็จของร้าน "ตั้งหง่วงเซ้ง" ทั้งหมดโดยอัตโนมัติหรือไม่?
                </h4>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button onClick={onClose} variant="outline" disabled={isApproving} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300">
              ยกเลิก
            </Button>
            <Button
              onClick={onConfirm}
              className="bg-slate-900 text-white hover:bg-slate-800"
              disabled={isApproving}
            >
              <Zap className="mr-2 h-4 w-4" />
              {isApproving ? 'กำลังอนุมัติ...' : 'ยืนยันการอนุมัติ'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
