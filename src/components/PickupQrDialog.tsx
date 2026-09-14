'use client'

/**
 * PickupQrDialog — QR รับของที่หน้าร้าน (Sprint 8)
 *
 * QR encode เป็น URL /admin/redemptions/scan?code=XXXXXXXX ของ origin ปัจจุบัน
 * → พนักงานใช้กล้องมือถือสแกนได้เลย เปิดหน้าแอดมิน (ต้อง login) แล้วกดยืนยันส่งมอบ
 * รหัสตัวอักษรแสดงคู่กันเผื่อสแกนไม่ติด พนักงานพิมพ์เองได้
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QrCode } from '@/components/QrCode'
import { REDEMPTION_STATUS_CUSTOMER_HINT, type RedemptionStatus } from '@/lib/redemption-status'

interface PickupQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pickupCode: string | null
  rewardName: string
  status: RedemptionStatus
}

export function pickupScanUrl(code: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/admin/redemptions/scan?code=${code}`
}

export function PickupQrDialog({ open, onOpenChange, pickupCode, rewardName, status }: PickupQrDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>QR รับของที่หน้าร้าน</DialogTitle>
          <DialogDescription>{rewardName}</DialogDescription>
        </DialogHeader>
        {pickupCode ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <QrCode value={pickupScanUrl(pickupCode)} size={220} />
            </div>
            <p className="text-xs text-gray-500">รหัสรับของ</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-gray-900">{pickupCode}</p>
            <p className="text-center text-xs text-gray-500">{REDEMPTION_STATUS_CUSTOMER_HINT[status]}</p>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-gray-500">
            ใบแลกนี้ยังไม่มีรหัสรับของ — แจ้งพนักงานที่หน้าร้านด้วยชื่อและเบอร์โทรของคุณ
          </p>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full rounded-xl">
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
