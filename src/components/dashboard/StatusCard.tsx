import { memo } from 'react'
import { IoMdRefresh } from "react-icons/io"

interface StatusCardProps {
  points: number
  isRefreshing?: boolean
  onRefresh?: () => void
}

export const StatusCard = memo(({ points, isRefreshing, onRefresh }: StatusCardProps) => (
  <div className="px-6 mt-4 mb-6">
    <div className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-gray-700/50 overflow-hidden">
      {/* Premium background pattern */}
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-amber-500/10"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-red-500/20 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-radial from-amber-500/20 to-transparent rounded-full translate-y-12 -translate-x-12"></div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">PREMIUM</span>
          </div>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
          >
            <IoMdRefresh className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="text-white mb-6">
          <h3 className="text-lg font-semibold mb-0.5 text-gray-300">คะแนนสะสม</h3>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              {points?.toLocaleString() || '0'}
            </span>
            <span className="text-amber-400 font-semibold text-lg">แต้ม</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="w-full bg-gray-700/60 rounded-full h-2 backdrop-blur-sm">
            <div
              className="bg-gradient-to-r from-emerald-400 to-green-500 h-2 rounded-full shadow-lg transition-all duration-1000"
              style={{ width: `${Math.min((points / 50000) * 100, 100)}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-gray-400 text-xs"></span>
            <span className="text-gray-400 text-xs">50,000 แต้ม</span>
          </div>
        </div>

        <div className="text-center pt-3 border-t border-gray-700/50">
          <p className="text-gray-400 text-xs">
            {isRefreshing ? 'กำลังอัพเดต...' : '✨ อัพเดตล่าสุด'}
          </p>
        </div>
      </div>
    </div>
  </div>
))

StatusCard.displayName = 'StatusCard'
