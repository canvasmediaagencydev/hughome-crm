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
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <img
                src={getAvatarUrl(user.picture_url, getUserDisplayName(user))}
                alt={getUserDisplayName(user)}
                className="w-20 h-20 rounded-full object-cover"
              />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{getUserDisplayName(user)}</h2>
                <div className="mt-2">
                  <RoleBadge role={user.role as 'contractor' | 'homeowner' | null} />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {loadingDetails ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">กำลังโหลด...</p>
            </div>
          ) : userDetails && (
            <>
              {/* User Info */}
              <div className="bg-gray-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">ข้อมูลผู้ใช้</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">เบอร์โทร:</span>
                    <span className="ml-2 font-medium">{user.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">แต้มคงเหลือ:</span>
                    <span className="ml-2 font-medium text-red-600">{formatPoints(user.points_balance || 0)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">สมัครเมื่อ:</span>
                    <span className="ml-2 font-medium">{formatDate(user.created_at, { includeTime: true })}</span>
                  </div>
                  {user.last_login_at && (
                    <div>
                      <span className="text-gray-600">Login ล่าสุด:</span>
                      <span className="ml-2 font-medium">{formatDate(user.last_login_at, { includeTime: true })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction History */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">ประวัติธุรกรรมล่าสุด</h3>
                {userDetails.transactionPagination.total === 0 ? (
                  <p className="text-center text-gray-500 py-4">ไม่มีประวัติธุรกรรม</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {userDetails.transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{getTransactionTypeLabel(transaction.transaction_type)}</div>
                            {transaction.description && (
                              <div className="text-xs text-gray-600">{transaction.description}</div>
                            )}
                            <div className="text-xs text-gray-500">{formatDate(transaction.created_at, { includeTime: true })}</div>
                          </div>
                          <div className={`text-lg font-bold ${getTransactionColor(transaction.transaction_type)}`}>
                            {transaction.points > 0 ? '+' : ''}{transaction.points}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Transaction Pagination */}
                    <Pagination
                      currentPage={userDetails.transactionPagination.page}
                      totalPages={userDetails.transactionPagination.totalPages}
                      onPageChange={onTransactionPageChange}
                      disabled={loadingDetails}
                    />
                  </>
                )}
              </div>

              {/* Redemption History */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">ประวัติการแลกรางวัล</h3>
                {userDetails.redemptionPagination.total === 0 ? (
                  <p className="text-center text-gray-500 py-4">ไม่มีประวัติการแลกรางวัล</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {userDetails.redemptions.map((redemption) => (
                        <div key={redemption.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          {redemption.rewards.image_url && (
                            <img
                              src={redemption.rewards.image_url}
                              alt={redemption.rewards.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900">{redemption.rewards.name}</div>
                            <div className="text-sm text-red-600 font-semibold">{formatPoints(redemption.points_used)}</div>
                            <div className="text-xs text-gray-500 mt-1">{formatDate(redemption.created_at, { includeTime: true })}</div>
                            {redemption.tracking_number && (
                              <div className="text-xs text-gray-600 mt-1">
                                Tracking: {redemption.tracking_number}
                              </div>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getRedemptionStatusColor(redemption.status)}`}>
                            {getRedemptionStatusLabel(redemption.status)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Redemption Pagination */}
                    <Pagination
                      currentPage={userDetails.redemptionPagination.page}
                      totalPages={userDetails.redemptionPagination.totalPages}
                      onPageChange={onRedemptionPageChange}
                      disabled={loadingDetails}
                    />
                  </>
                )}
              </div>
            </>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
