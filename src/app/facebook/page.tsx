'use client'

/**
 * /facebook — เพจร้าน (Sprint 9R A7) · แท็บที่ 4 ของแถบล่าง
 * ลิงก์เพจมาจาก TENANT.facebookUrl เท่านั้น (env ต่อสาขา · ไม่มี default)
 * เปิดเป็นแท็บใหม่/แอปภายนอก — LIFF บน Android จะส่งต่อให้แอป Facebook เองถ้าติดตั้งไว้
 */
import { FaFacebook, FaExternalLinkAlt } from 'react-icons/fa'
import BottomNavigation from '@/components/BottomNavigation'
import { TENANT } from '@/config/tenant'

export default function FacebookPage() {
  let host = TENANT.facebookUrl
  try {
    host = new URL(TENANT.facebookUrl).host.replace(/^www\./, '')
  } catch {
    /* env ผ่าน requiredUrl มาแล้ว — กันไว้เฉย ๆ */
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        </div>
        <div className="relative px-6 pt-8 pb-10">
          <p className="text-white/80 text-sm font-medium">โปรโมชันและข่าวสาร</p>
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
          href={TENANT.facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-2xl p-5 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 shrink-0 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center">
              <FaFacebook className="w-8 h-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-gray-500 text-xs mb-1">เพจ Facebook ของร้าน</p>
              <p className="text-gray-900 font-semibold text-lg break-all">{host}</p>
              <p className="text-blue-700 text-xs mt-1 flex items-center gap-1">
                เปิดเพจ <FaExternalLinkAlt className="w-3 h-3" />
              </p>
            </div>
          </div>
        </a>

        <p className="text-center text-gray-400 text-xs px-4">
          ติดตามโปรโมชันแต้มพิเศษ สินค้าใหม่ และกิจกรรมของร้านได้ที่เพจ
        </p>
      </div>

      <BottomNavigation currentPage="facebook" />
    </div>
  )
}
