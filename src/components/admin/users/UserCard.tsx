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
    <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
      {/* User Avatar & Name */}
      <div className="flex items-start gap-4 mb-4">
        <img
          src={getAvatarUrl(user.picture_url, getUserDisplayName(user))}
          alt={getUserDisplayName(user)}
          className="w-16 h-16 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{getUserDisplayName(user)}</h3>
          <div className="mt-1">
            <RoleBadge role={user.role as 'contractor' | 'homeowner' | null} />
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="space-y-2 mb-4 text-sm">
        {user.phone && (
          <div className="flex items-center gap-2 text-gray-600">
            <FaPhone className="w-4 h-4" />
            <span>{user.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-gray-600">
          <FaCoins className="w-4 h-4" />
          <span className="font-semibold text-red-600">{formatPoints(user.points_balance || 0)}</span>
        </div>
        {user.last_login_at && (
          <div className="text-xs text-gray-500">
            Login ล่าสุด: {formatDate(user.last_login_at, { includeTime: true })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onViewDetails(user)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
        >
          <HiEye className="w-4 h-4" />
          รายละเอียด
        </button>
        <button
          onClick={() => onEditPoints(user)}
          className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors"
        >
          <FaCoins className="w-4 h-4" />
        </button>
        <button
          onClick={() => onEditRole(user)}
          className="flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm transition-colors"
        >
          <HiPencil className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
