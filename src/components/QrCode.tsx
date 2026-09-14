'use client'

/**
 * QrCode — รูป QR ของข้อความ/URL (ใช้กับรหัสรับของ Sprint 8)
 * render ในเครื่องด้วย qrcode.react (SVG) — ไม่พึ่งบริการภายนอก ทำงานได้แม้ LIFF ออกเน็ตช้า
 */
import { QRCodeSVG } from 'qrcode.react'

interface QrCodeProps {
  value: string
  size?: number
  className?: string
}

export function QrCode({ value, size = 220, className }: QrCodeProps) {
  return <QRCodeSVG value={value} size={size} level="M" marginSize={2} className={className} />
}
