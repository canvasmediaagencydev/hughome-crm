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
          <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg">
            <Image
              src={imageUrl}
              alt="Receipt full size"
              width={800}
              height={600}
              className="w-full h-auto object-contain"
              sizes="(max-width: 768px) 100vw, 800px"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = '/placeholder-receipt.png'
              }}
            />
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
