import { User } from '@/types'
import { HiEye, HiPencil } from 'react-icons/hi'
import { FaUser, FaPhone, FaCoins } from 'react-icons/fa'
import { RoleBadge } from '@/components/StatusBadge'
import { formatDate, formatPoints, getUserDisplayName, getAvatarUrl } from '@/lib/utils'

interface UserCardProps {
  user: User
  onViewDetails: (user: User) => void
  onEditPoints: (user: User) => void
  onEditRole: (user: User) => void
}

export function UserCard({ user, onViewDetails, onEditPoints, onEditRole }: UserCardProps) {
  return (
    <div className="group bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-300 hover:shadow-lg transition-all duration-200">
      {/* User Avatar & Name */}
      <div className="flex items-start gap-3 mb-4">
        <img
          src={getAvatarUrl(user.picture_url, getUserDisplayName(user))}
          alt={getUserDisplayName(user)}
          className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-200 group-hover:ring-blue-400 transition-all"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 truncate text-sm">{getUserDisplayName(user)}</h3>
          <div className="mt-1.5">
            <RoleBadge role={user.role as 'contractor' | 'homeowner' | null} />
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="space-y-2 mb-4 text-sm">
        {user.phone && (
          <div className="flex items-center gap-2 text-slate-600">
            <FaPhone className="w-3.5 h-3.5 text-slate-400" />
            <span>{user.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-600">
          <FaCoins className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-slate-900">{formatPoints(user.points_balance || 0)} คะแนน</span>
        </div>
        {user.last_login_at && (
          <div className="text-xs text-slate-500">
            Login ล่าสุด: {formatDate(user.last_login_at, { includeTime: true })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetails(user)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors"
        >
          <HiEye className="w-4 h-4" />
          รายละเอียด
        </button>
        <button
          onClick={() => onEditPoints(user)}
          className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm transition-colors"
          title="แก้ไขคะแนน"
        >
          <FaCoins className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEditRole(user)}
          className="flex items-center justify-center px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm transition-colors"
          title="แก้ไขบทบาท"
        >
          <HiPencil className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
