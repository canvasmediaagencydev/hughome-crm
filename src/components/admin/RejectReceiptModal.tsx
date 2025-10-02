import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { X } from 'lucide-react'
import { useState } from 'react'

interface RejectReceiptModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  isRejecting: boolean
}

export function RejectReceiptModal({
  open,
  onClose,
  onConfirm,
  isRejecting
}: RejectReceiptModalProps) {
  const [reason, setReason] = useState('')

  const handleConfirm = () => {
    if (!reason.trim()) {
      return
    }
    onConfirm(reason.trim())
    setReason('')
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ปฏิเสธใบเสร็จ</DialogTitle>
          <DialogDescription>
            กรุณาระบุเหตุผลในการปฏิเสธใบเสร็จ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-slate-700">เหตุผล *</Label>
            <Textarea
              id="reject-reason"
              placeholder="ระบุเหตุผลในการปฏิเสธ..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              disabled={isRejecting}
              className="resize-none border-slate-300 focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button onClick={handleClose} variant="outline" disabled={isRejecting} className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300">
              ยกเลิก
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isRejecting || !reason.trim()}
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
