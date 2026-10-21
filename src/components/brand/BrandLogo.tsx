/**
 * โลโก้ฮักโฮมตาม CI (BRANDING GUIDEBOOK-HUGHOME · Logo System) — 2026-10-21
 *
 *   <BrandMark />                         สัญลักษณ์บ้าน (SVG วาดจากไฟล์โลโก้ · คมทุกขนาด)
 *   <BrandLogo />                         สัญลักษณ์ + "ฮักโฮม" (บนพื้นขาว: บ้านแดง ตัวอักษรเทาเข้ม)
 *   <BrandLogo tone="white" />            ทั้งหมดสีขาว — ใช้บนพื้นแดง/เทาเข้มเท่านั้น
 *
 * ไฟล์ต้นฉบับ: public/brand/ (ตัดขอบจาก logopng1-01_0.png ที่ลูกค้าส่งมา)
 */
import Image from 'next/image'

const MARK_PATH =
  'M50 0 L110.5 40 L110.5 67 L100 61 L100 106 L78 106 L78 43.5 L50 25 Z M0.5 74.5 L51 40.5 L70 53 L70 79 L51 67.5 L24 87 L24 106 L100 106 L100 131 L0.5 131 Z'

type Tone = 'color' | 'white'

export function BrandMark({ tone = 'color', className = 'h-8 w-auto' }: { tone?: Tone; className?: string }) {
  return (
    <svg viewBox="0 0 111 131" className={className} role="img" aria-label="ฮักโฮม">
      <path fill={tone === 'white' ? '#FFFFFF' : '#E71C24'} d={MARK_PATH} />
    </svg>
  )
}

/** wordmark ไทย 479×131 — ส่ง height ที่ต้องการ (px) ความกว้างคำนวณตามสัดส่วน */
export function BrandLogo({ tone = 'color', height = 32, className = '', priority = false }: {
  tone?: Tone
  height?: number
  className?: string
  priority?: boolean
}) {
  return (
    <Image
      src={tone === 'white' ? '/brand/hughome-logo-th-white.png' : '/brand/hughome-logo-th.png'}
      alt="ฮักโฮม"
      width={Math.round((height * 479) / 131)}
      height={height}
      priority={priority}
      className={className}
    />
  )
}
