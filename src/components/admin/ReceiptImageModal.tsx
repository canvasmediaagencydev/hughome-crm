import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface ReceiptImageModalProps {
  open: boolean
  onClose: () => void
  imageUrl: string
}

export function ReceiptImageModal({
  open,
  onClose,
  imageUrl
}: ReceiptImageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>รูปใบเสร็จ</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative w-full max-h-[80vh] overflow-auto rounded-lg bg-gray-100 flex items-center justify-center">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="Receipt full size"
                width={1920}
                height={1080}
                className="w-auto h-auto max-w-full"
                sizes="(max-width: 768px) 100vw, 1920px"
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500">ไม่พบรูปภาพใบเสร็จ</p>
              </div>
            )}
          </div>
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
