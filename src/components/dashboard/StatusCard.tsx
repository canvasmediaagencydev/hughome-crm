import { memo } from 'react'
import { IoMdRefresh } from "react-icons/io"

interface StatusCardProps {
  points: number
  isRefreshing?: boolean
  onRefresh?: () => void
}

export const StatusCard = memo(({ points, isRefreshing, onRefresh }: StatusCardProps) => (
  <div className="mt-5 mx-4 mb-4">
    <div className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 rounded-2xl p-6 shadow-2xl border border-gray-700/50 overflow-hidden">
      {/* Premium background pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-amber-500/10"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-red-500/20 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-radial from-amber-500/20 to-transparent rounded-full translate-y-12 -translate-x-12"></div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">PREMIUM</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <IoMdRefresh className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="text-white mb-5">
          <h3 className="text-xl font-bold mb-1 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">คะแนนสะสม</h3>
          <p className="text-sm text-gray-400">Total Loyalty Points</p>
        </div>

        <div className="mb-5">
          <div className="w-full bg-gray-700/60 rounded-full h-2.5 backdrop-blur-sm">
            <div
              className="bg-gradient-to-r from-emerald-400 to-green-500 h-2.5 rounded-full shadow-lg transition-all duration-1000"
              style={{ width: `${Math.min((points / 50000) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <span className="text-gray-400 text-sm">ยอดรวม</span>
            <div className="text-white font-bold text-2xl bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text">
              {points?.toLocaleString() || '0'} <span className="text-lg text-amber-400">แต้ม</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-gray-400 text-xs">สถานะ</span>
            <div className="text-emerald-400 font-semibold text-sm">
              {isRefreshing ? 'อัพเดต...' : '✨ อัพเดตล่าสุด'}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
))

StatusCard.displayName = 'StatusCard'
