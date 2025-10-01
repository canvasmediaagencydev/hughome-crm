import { memo } from 'react'
import { useRouter } from 'next/navigation'
import { IoMdHome } from "react-icons/io"
import { FaUser, FaHistory } from "react-icons/fa"
import { HiOutlineGift } from "react-icons/hi"

interface BottomNavigationProps {
  currentPage: 'home' | 'rewards' | 'history' | 'profile'
}

const BottomNavigation = memo(({ currentPage }: BottomNavigationProps) => {
  const router = useRouter()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-gray-100 shadow-2xl backdrop-blur-lg z-50">
      <div className="flex justify-around items-center py-2 px-4 safe-area-pb">
        <button
          onClick={() => router.push('/dashboard')}
          className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-gray-50 active:scale-95 ${currentPage === 'home' ? 'text-red-500' : 'text-gray-500'}`}
        >
          <div className="w-6 h-6 mb-1 relative">
            <IoMdHome className="w-full h-full" />
            {currentPage === 'home' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
          </div>
          <span className={`text-xs font-medium ${currentPage === 'home' ? 'font-semibold' : ''}`}>หน้าหลัก</span>
        </button>

        <button
          onClick={() => router.push('/rewards')}
          className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-red-50 active:scale-95 ${currentPage === 'rewards' ? 'text-red-500' : 'text-gray-500'}`}
        >
          <div className="w-6 h-6 mb-1 relative">
            <HiOutlineGift className="w-full h-full" />
            {currentPage === 'rewards' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
          </div>
          <span className={`text-xs font-medium ${currentPage === 'rewards' ? 'font-semibold text-red-600' : ''}`}>รางวัล</span>
        </button>

        <button
          onClick={() => router.push('/history')}
          className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-gray-50 active:scale-95 ${currentPage === 'history' ? 'text-red-500' : 'text-gray-500'}`}
        >
          <div className="w-6 h-6 mb-1 relative">
            <FaHistory className="w-full h-full" />
            {currentPage === 'history' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
          </div>
          <span className={`text-xs font-medium ${currentPage === 'history' ? 'font-semibold text-red-600' : ''}`}>ประวัติ</span>
        </button>

        <button
          onClick={() => router.push('/profile')}
          className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all duration-200 hover:bg-gray-50 active:scale-95 ${currentPage === 'profile' ? 'text-red-500' : 'text-gray-500'}`}
        >
          <div className="w-6 h-6 mb-1 relative">
            <FaUser className="w-full h-full" />
            {currentPage === 'profile' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>}
          </div>
          <span className={`text-xs font-medium ${currentPage === 'profile' ? 'font-semibold text-red-600' : ''}`}>โปรไฟล์</span>
        </button>
      </div>
    </div>
  )
})

BottomNavigation.displayName = 'BottomNavigation'

export default BottomNavigation
