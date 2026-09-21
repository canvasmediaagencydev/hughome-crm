import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { IoMdHome } from 'react-icons/io'
import { FaUser, FaPhone, FaFacebook } from 'react-icons/fa'
import { HiOutlineGift } from 'react-icons/hi'

/**
 * แถบล่างฝั่งลูกค้า — 5 แท็บตามที่ลูกค้าขอ (Sprint 9R A7): หน้าหลัก · แลกรางวัล · โทรร้าน · Facebook · โปรไฟล์
 * ไม่มีแท็บ "ประวัติ" อีกแล้ว (หน้า /history ถูกตัด) · ประวัติการแลกอยู่ใน /rewards?tab=history
 * สูงคงที่ ~4.5rem + safe-area · ทุกหน้าที่ใช้ต้องมี padding-bottom ≥ 6rem กันเนื้อหาถูกทับ
 */
export type CustomerTab = 'home' | 'rewards' | 'call' | 'facebook' | 'profile'

interface BottomNavigationProps {
  currentPage: CustomerTab
}

const TABS: { key: CustomerTab; label: string; href: string; Icon: typeof IoMdHome }[] = [
  { key: 'home', label: 'หน้าหลัก', href: '/dashboard', Icon: IoMdHome },
  { key: 'rewards', label: 'แลกรางวัล', href: '/rewards', Icon: HiOutlineGift },
  { key: 'call', label: 'โทรร้าน', href: '/call', Icon: FaPhone },
  { key: 'facebook', label: 'Facebook', href: '/facebook', Icon: FaFacebook },
  { key: 'profile', label: 'โปรไฟล์', href: '/profile', Icon: FaUser },
]

const BottomNavigation = memo(({ currentPage }: BottomNavigationProps) => {
  const router = useRouter()

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl border-t border-gray-100 shadow-2xl"
    >
      <div className="grid grid-cols-5 items-stretch px-1 pt-1 safe-area-pb">
        {TABS.map(({ key, label, href, Icon }) => {
          const active = currentPage === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => router.push(href)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-w-0 py-2 rounded-xl transition-all duration-200 active:scale-95 ${
                active ? 'text-red-600' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <div className="relative w-6 h-6 mb-0.5">
                <Icon className="w-full h-full" />
                {active && <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </div>
              <span className={`text-[11px] leading-tight truncate max-w-full ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
})

BottomNavigation.displayName = 'BottomNavigation'

export default BottomNavigation
