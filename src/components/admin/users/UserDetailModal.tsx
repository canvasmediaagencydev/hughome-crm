import { User, UserDetails } from '@/types'
import { Pagination } from '@/components/Pagination'
import { RoleBadge } from '@/components/StatusBadge'
import {
  formatDate,
  formatPoints,
  getUserDisplayName,
  getAvatarUrl,
  getTransactionTypeLabel,
  getTransactionColor,
  getRedemptionStatusLabel,
  getRedemptionStatusColor
} from '@/lib/utils'

interface UserDetailModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  userDetails: UserDetails | null
  loadingDetails: boolean
  onTransactionPageChange: (page: number) => void
  onRedemptionPageChange: (page: number) => void
}

export function UserDetailModal({
  isOpen,
  onClose,
  user,
  userDetails,
  loadingDetails,
  onTransactionPageChange,
  onRedemptionPageChange
}: UserDetailModalProps) {
  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={getAvatarUrl(user.picture_url, getUserDisplayName(user))}
              alt={getUserDisplayName(user)}
              className="w-16 h-16 rounded-full object-cover ring-2 ring-slate-200"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900">{getUserDisplayName(user)}</h2>
              <div className="mt-1">
                <RoleBadge role={user.role as 'contractor' | 'homeowner' | null} />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loadingDetails ? (
            <div className="text-center py-12">
              <div className="relative inline-flex">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-900 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <p className="text-slate-600 mt-4 font-medium">กำลังโหลด...</p>
            </div>
          ) : userDetails && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">ข้อมูลผู้ใช้</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">เบอร์โทร</span>
                    <span className="text-sm font-medium text-slate-900">{user.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">แต้มคงเหลือ</span>
                    <span className="text-sm font-bold text-blue-600">{formatPoints(user.points_balance || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm text-slate-600">สมัครเมื่อ</span>
                    <span className="text-sm font-medium text-slate-900">{formatDate(user.created_at)}</span>
                  </div>
                  {user.last_login_at && (
                    <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-sm text-slate-600">Login ล่าสุด</span>
                      <span className="text-sm font-medium text-slate-900">{formatDate(user.last_login_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction History */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">ประวัติธุรกรรม</h3>
                {userDetails.transactionPagination.total === 0 ? (
                  <p className="text-center text-slate-500 py-8">ไม่มีประวัติธุรกรรม</p>
                ) : (
                  <div className="space-y-3">
                    {userDetails.transactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">{getTransactionTypeLabel(transaction.transaction_type)}</div>
                          {transaction.description && (
                            <div className="text-xs text-slate-600 mt-1">{transaction.description}</div>
                          )}
                          <div className="text-xs text-slate-500 mt-1">{formatDate(transaction.created_at, { includeTime: true })}</div>
                        </div>
                        <div className={`text-lg font-bold ml-4 ${getTransactionColor(transaction.transaction_type)}`}>
                          {transaction.points > 0 ? '+' : ''}{transaction.points}
                        </div>
                      </div>
                    ))}

                    {userDetails.transactionPagination.totalPages > 1 && (
                      <div className="pt-4 mt-4 border-t border-slate-200">
                        <Pagination
                          currentPage={userDetails.transactionPagination.page}
                          totalPages={userDetails.transactionPagination.totalPages}
                          onPageChange={onTransactionPageChange}
                          disabled={loadingDetails}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Redemption History */}
              <div className="bg-white border border-slate-200 p-5 rounded-lg">
                <h3 className="font-semibold text-slate-900 mb-4">ประวัติการแลกรางวัล</h3>
                {userDetails.redemptionPagination.total === 0 ? (
                  <p className="text-center text-slate-500 py-8">ไม่มีประวัติการแลกรางวัล</p>
                ) : (
                  <div className="space-y-3">
                    {userDetails.redemptions.map((redemption) => (
                      <div key={redemption.id} className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
                        {redemption.rewards.image_url && (
                          <img
                            src={redemption.rewards.image_url}
                            alt={redemption.rewards.name}
                            className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900">{redemption.rewards.name}</div>
                          <div className="text-sm text-blue-600 font-semibold mt-1">{formatPoints(redemption.points_used)} แต้ม</div>
                          <div className="text-xs text-slate-500 mt-1">{formatDate(redemption.created_at, { includeTime: true })}</div>
                          {redemption.tracking_number && (
                            <div className="text-xs text-slate-600 mt-1">
                              Tracking: {redemption.tracking_number}
                            </div>
                          )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getRedemptionStatusColor(redemption.status)}`}>
                          {getRedemptionStatusLabel(redemption.status)}
                        </span>
                      </div>
                    ))}

                    {userDetails.redemptionPagination.totalPages > 1 && (
                      <div className="pt-4 mt-4 border-t border-slate-200">
                        <Pagination
                          currentPage={userDetails.redemptionPagination.page}
                          totalPages={userDetails.redemptionPagination.totalPages}
                          onPageChange={onRedemptionPageChange}
                          disabled={loadingDetails}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
