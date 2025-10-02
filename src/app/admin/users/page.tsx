'use client'

import { useState, useEffect } from 'react'
import { HiSearch, HiEye, HiPencil } from 'react-icons/hi'
import { FaUser, FaPhone, FaCoins } from 'react-icons/fa'
import axios from 'axios'
import { toast } from 'sonner'
import { Pagination } from '@/components/Pagination'
import { RoleBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
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

interface User {
  id: string
  line_user_id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  picture_url: string | null
  role: string | null
  points_balance: number | null
  is_admin: boolean | null
  last_login_at: string | null
  total_receipts: number | null
  created_at: string
}

interface Transaction {
  id: string
  points: number
  transaction_type: string
  description: string | null
  created_at: string
  balance_after: number | null
}

interface Redemption {
  id: string
  points_used: number
  status: string
  shipping_address: string | null
  tracking_number: string | null
  created_at: string
  rewards: {
    name: string
    image_url: string | null
  }
}

interface UserDetails {
  user: User
  transactions: Transaction[]
  transactionPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  redemptions: Redemption[]
  redemptionPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showPointsModal, setShowPointsModal] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Points modal states
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [pointsAction, setPointsAction] = useState<'add' | 'deduct'>('add')
  const [processingPoints, setProcessingPoints] = useState(false)

  // Role modal states
  const [newRole, setNewRole] = useState<'contractor' | 'homeowner'>('contractor')
  const [processingRole, setProcessingRole] = useState(false)

  const fetchUsers = async (page: number, role: string, search: string) => {
    try {
      setIsLoading(true)
      const response = await axios.get('/api/admin/users', {
        params: { page, limit: 9, role, search }
      })

      setUsers(response.data.users)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(currentPage, roleFilter, searchQuery)
  }, [currentPage, roleFilter, searchQuery])

  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
    setCurrentPage(1)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  const fetchUserDetails = async (userId: string, transactionPage: number = 1, redemptionPage: number = 1) => {
    try {
      setLoadingDetails(true)
      const response = await axios.get(`/api/admin/users/${userId}`, {
        params: {
          transactionPage,
          transactionLimit: 5,
          redemptionPage,
          redemptionLimit: 3
        }
      })
      setUserDetails(response.data)
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดรายละเอียด')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleViewDetails = async (user: User) => {
    setSelectedUser(user)
    setShowDetailModal(true)
    await fetchUserDetails(user.id, 1, 1)
  }

  const handleTransactionPageChange = async (newPage: number) => {
    if (selectedUser && userDetails) {
      await fetchUserDetails(selectedUser.id, newPage, userDetails.redemptionPagination.page)
    }
  }

  const handleRedemptionPageChange = async (newPage: number) => {
    if (selectedUser && userDetails) {
      await fetchUserDetails(selectedUser.id, userDetails.transactionPagination.page, newPage)
    }
  }

  const handleEditPoints = (user: User) => {
    setSelectedUser(user)
    setPointsAmount('')
    setPointsReason('')
    setPointsAction('add')
    setShowPointsModal(true)
  }

  const handleEditRole = (user: User) => {
    setSelectedUser(user)
    setNewRole((user.role as 'contractor' | 'homeowner') || 'contractor')
    setShowRoleModal(true)
  }

  const confirmAdjustPoints = async () => {
    if (!selectedUser || !pointsAmount || !pointsReason.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    const amount = parseFloat(pointsAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนแต้มที่มากกว่า 0')
      return
    }

    // Calculate final amount and determine type based on action
    const finalAmount = pointsAction === 'add' ? amount : -amount
    const transactionType = pointsAction === 'add' ? 'bonus' : 'spent'

    try {
      setProcessingPoints(true)
      await axios.post(`/api/admin/users/${selectedUser.id}/points`, {
        amount: finalAmount,
        reason: pointsReason,
        type: transactionType
      })

      toast.success(`${pointsAction === 'add' ? 'เพิ่ม' : 'ลด'}แต้มสำเร็จ`)
      setShowPointsModal(false)
      fetchUsers(currentPage, roleFilter, searchQuery)
    } catch (error: any) {
      console.error('Error adjusting points:', error)
      toast.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการปรับแต้ม')
    } finally {
      setProcessingPoints(false)
    }
  }

  const confirmChangeRole = async () => {
    if (!selectedUser) return

    try {
      setProcessingRole(true)
      await axios.patch(`/api/admin/users/${selectedUser.id}/role`, {
        role: newRole
      })

      toast.success('เปลี่ยน Role สำเร็จ')
      setShowRoleModal(false)
      fetchUsers(currentPage, roleFilter, searchQuery)
    } catch (error: any) {
      console.error('Error changing role:', error)
      toast.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการเปลี่ยน Role')
    } finally {
      setProcessingRole(false)
    }
  }

  const roleTabs = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'homeowner', label: 'Homeowner' }
  ]



  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
       
        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              ค้นหา
            </button>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                ล้าง
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 mt-2">
              กำลังค้นหา: <span className="font-semibold">"{searchQuery}"</span>
            </p>
          )}
        </div>

        {/* Role Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {roleTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setRoleFilter(tab.value)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  roleFilter === tab.value
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">กำลังโหลด...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm">
            <EmptyState
              icon={<FaUser className="w-16 h-16 text-gray-400" />}
              title="ไม่พบข้อมูลผู้ใช้"
              className="py-16"
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map((user) => (
                <div key={user.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
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
                      onClick={() => handleViewDetails(user)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
                    >
                      <HiEye className="w-4 h-4" />
                      รายละเอียด
                    </button>
                    <button
                      onClick={() => handleEditPoints(user)}
                      className="flex items-center justify-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm transition-colors"
                    >
                      <FaCoins className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditRole(user)}
                      className="flex items-center justify-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm transition-colors"
                    >
                      <HiPencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <img
                    src={getAvatarUrl(selectedUser.picture_url, getUserDisplayName(selectedUser))}
                    alt={getUserDisplayName(selectedUser)}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{getUserDisplayName(selectedUser)}</h2>
                    <div className="mt-2">
                      <RoleBadge role={selectedUser.role as 'contractor' | 'homeowner' | null} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
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
                        <span className="ml-2 font-medium">{selectedUser.phone || '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">แต้มคงเหลือ:</span>
                        <span className="ml-2 font-medium text-red-600">{formatPoints(selectedUser.points_balance || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">สมัครเมื่อ:</span>
                        <span className="ml-2 font-medium">{formatDate(selectedUser.created_at, { includeTime: true })}</span>
                      </div>
                      {selectedUser.last_login_at && (
                        <div>
                          <span className="text-gray-600">Login ล่าสุด:</span>
                          <span className="ml-2 font-medium">{formatDate(selectedUser.last_login_at, { includeTime: true })}</span>
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
                          onPageChange={handleTransactionPageChange}
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
                          onPageChange={handleRedemptionPageChange}
                          disabled={loadingDetails}
                        />
                      </>
                    )}
                  </div>
                </>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Points Modal */}
      {showPointsModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">ปรับแต้มผู้ใช้</h3>
            <p className="text-gray-600 mb-4">
              ผู้ใช้: <span className="font-semibold">{getUserDisplayName(selectedUser)}</span>
            </p>
            <p className="text-gray-600 mb-4">
              แต้มปัจจุบัน: <span className="font-semibold text-red-600">{formatPoints(selectedUser.points_balance || 0)}</span>
            </p>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ประเภทการปรับแต้ม
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    pointsAction === 'add'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      value="add"
                      checked={pointsAction === 'add'}
                      onChange={(e) => setPointsAction(e.target.value as 'add' | 'deduct')}
                      className="mr-3 w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">เพิ่มแต้ม</div>
                      <div className="text-sm text-gray-600">เพิ่มแต้มให้ผู้ใช้ (โบนัส/คืนเงิน)</div>
                    </div>
                  </label>
                  <label className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                    pointsAction === 'deduct'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}>
                    <input
                      type="radio"
                      value="deduct"
                      checked={pointsAction === 'deduct'}
                      onChange={(e) => setPointsAction(e.target.value as 'add' | 'deduct')}
                      className="mr-3 w-4 h-4 text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">ลดแต้ม</div>
                      <div className="text-sm text-gray-600">หักแต้มจากผู้ใช้</div>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนแต้ม (ตัวเลขบวกเท่านั้น)
                </label>
                <input
                  type="number"
                  value={pointsAmount}
                  onChange={(e) => setPointsAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เหตุผล
                </label>
                <textarea
                  value={pointsReason}
                  onChange={(e) => setPointsReason(e.target.value)}
                  placeholder="ระบุเหตุผลในการปรับแต้ม..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmAdjustPoints}
                disabled={processingPoints}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {processingPoints ? 'กำลังปรับแต้ม...' : 'ยืนยัน'}
              </button>
              <button
                onClick={() => setShowPointsModal(false)}
                disabled={processingPoints}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">เปลี่ยน Role ผู้ใช้</h3>
            <p className="text-gray-600 mb-4">
              ผู้ใช้: <span className="font-semibold">{getUserDisplayName(selectedUser)}</span>
            </p>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-600">Role ปัจจุบัน:</span>
              <RoleBadge role={selectedUser.role as 'contractor' | 'homeowner' | null} />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                เลือก Role ใหม่
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="contractor"
                    checked={newRole === 'contractor'}
                    onChange={(e) => setNewRole(e.target.value as 'contractor' | 'homeowner')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Contractor</div>
                    <div className="text-xs text-gray-500">ผู้รับเหมา/ช่าง</div>
                  </div>
                </label>
                <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="homeowner"
                    checked={newRole === 'homeowner'}
                    onChange={(e) => setNewRole(e.target.value as 'contractor' | 'homeowner')}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium">Homeowner</div>
                    <div className="text-xs text-gray-500">เจ้าของบ้าน</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmChangeRole}
                disabled={processingRole}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {processingRole ? 'กำลังเปลี่ยน...' : 'ยืนยัน'}
              </button>
              <button
                onClick={() => setShowRoleModal(false)}
                disabled={processingRole}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
