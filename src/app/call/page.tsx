'use client'

/**
 * /call — โทรร้าน (Sprint 9R A7) · แท็บที่ 3 ของแถบล่าง
 * เบอร์ร้านและ LINE OA มาจาก TENANT เท่านั้น (env ต่อสาขา · ไม่มี default) — ห้าม hardcode ที่นี่
 */
import { FaPhone } from 'react-icons/fa'
import { SiLine } from 'react-icons/si'
import BottomNavigation from '@/components/BottomNavigation'
import { TENANT } from '@/config/tenant'

/** 0812345678 → 081-234-5678 สำหรับอ่านบนจอเท่านั้น · ลิงก์ tel: ใช้เลขติดกัน */
function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  // เบอร์บ้าน 9 หลัก (052 000 369) → 052-000-369
  if (digits.length === 9) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  return phone
}

export default function CallPage() {
  const telHref = `tel:${TENANT.phone.replace(/[^\d+]/g, '')}`
  const lineHref = `https://line.me/R/ti/p/${encodeURIComponent(TENANT.lineOaId)}`

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-500 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative px-6 pt-8 pb-10">
          <p className="text-white/80 text-sm font-medium">ติดต่อร้าน</p>
          <h1 className="text-white font-bold text-2xl leading-tight mt-1 break-words">{TENANT.name}</h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1200 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-6">
            <path d="M0 20C150 35 350 35 600 20C850 5 1050 5 1200 20V40H0V20Z" fill="#F9FAFB" />
          </svg>
        </div>
      </div>

      <div className="px-6 mt-6 space-y-4">
        <a
          href={telHref}
          className="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center">
              <FaPhone className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs mb-1">โทรหาร้าน</p>
              <p className="text-gray-900 font-bold text-2xl tabular-nums tracking-wide break-all">{displayPhone(TENANT.phone)}</p>
              <p className="text-emerald-700 text-xs mt-1">แตะเพื่อโทรทันที</p>
            </div>
          </div>
        </a>

        <a
          href={lineHref}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center">
              <SiLine className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs mb-1">แชทกับร้านทาง LINE</p>
              <p className="text-gray-900 font-semibold text-lg break-all">{TENANT.lineOaId}</p>
              <p className="text-green-700 text-xs mt-1">เปิด LINE Official Account</p>
            </div>
          </div>
        </a>

        <p className="text-center text-gray-400 text-xs px-4">
          สอบถามแต้ม การแลกของรางวัล หรือรับของที่ร้าน แจ้งรหัสลูกค้าของคุณ (ดูได้ที่หน้าหลัก)
        </p>
      </div>

      <BottomNavigation currentPage="call" />
    </div>
  )
}
