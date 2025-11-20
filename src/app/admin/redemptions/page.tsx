'use client'

import { useState, useEffect } from 'react'
import { HiOutlineGift, HiCheckCircle, HiXCircle, HiSearch } from 'react-icons/hi'
import { Shield } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { FaUser, FaPhone } from 'react-icons/fa'
import { UserSessionManager } from '@/lib/user-session'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import {
  formatDate,
  formatPoints,
  getUserDisplayName,
  getRedemptionStatusLabel
} from '@/lib/utils'
import { axiosAdmin } from '@/lib/axios-admin'
import { toast } from 'sonner'

interface Redemption {
  id: string
  created_at: string
  points_used: number
  quantity: number
  status: 'requested' | 'processing' | 'shipped' | 'cancelled'
  shipping_address: string | null
  admin_notes: string | null
  processed_at: string | null
  rewards: {
    id: string
    name: string
    description: string | null
    image_url: string | null
    points_cost: number
  }
  user_profiles: {
    id: string
    display_name: string | null
    first_name: string | null
    last_name: string | null
    phone: string | null
  }
}

interface PaginationType {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminRedemptionsPage() {
  const { hasPermission, loading: authLoading } = useAdminAuth()

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto mb-2"></div>
          <p className="text-slate-500">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  if (!hasPermission(PERMISSIONS.REDEMPTIONS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600">คุณไม่มีสิทธิ์ในการดูการแลกรางวัล</p>
        </div>
      </div>
    )
  }

  const canProcess = hasPermission(PERMISSIONS.REDEMPTIONS_PROCESS)

  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationType | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [selectedRedemption, setSelectedRedemption] = useState<Redemption | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchRedemptions = async (page: number, status: string, search: string) => {
    try {
      setIsLoading(true)
      const response = await axiosAdmin.get('/api/admin/redemptions', {
        params: { page, limit: 10, status, search },
      })

      setRedemptions(response.data.redemptions)
      setPagination(response.data.pagination)
    } catch (error) {
      console.error('Error fetching redemptions:', error)
      toast.error('ไม่สามารถโหลดคำขอแลกรางวัลได้')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRedemptions(currentPage, statusFilter, searchQuery)
  }, [currentPage, statusFilter, searchQuery])

  const handleApprove = async (redemptionId: string) => {
    try {
      setProcessingId(redemptionId)
      await axiosAdmin.post(
        `/api/admin/redemptions/${redemptionId}/complete`,
        {
          adminId: null,
          adminNotes: null,
        }
      )

      fetchRedemptions(currentPage, statusFilter, searchQuery)
    } catch (error) {
      console.error('Error approving redemption:', error)
      alert('เกิดข้อผิดพลาดในการอนุมัติ')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = (redemption: Redemption) => {
    setSelectedRedemption(redemption)
    setAdminNotes('')
    setShowNotesModal(true)
  }

  const confirmReject = async () => {
    if (!selectedRedemption) return

    try {
      setProcessingId(selectedRedemption.id)
      await axiosAdmin.post(
        `/api/admin/redemptions/${selectedRedemption.id}/cancel`,
        {
          adminId: null,
          adminNotes,
        }
      )

      setShowNotesModal(false)
      setSelectedRedemption(null)
      setAdminNotes('')
      fetchRedemptions(currentPage, statusFilter, searchQuery)
    } catch (error) {
      console.error('Error rejecting redemption:', error)
      alert('เกิดข้อผิดพลาดในการปฏิเสธ')
    } finally {
      setProcessingId(null)
    }
  }


  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const statusTabs = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'requested', label: 'รอรับของ' },
    { value: 'shipped', label: 'มอบของแล้ว' },
    { value: 'cancelled', label: 'ปฏิเสธ' }
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Search Bar */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อหรือเบอร์โทร..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
            >
              ค้นหา
            </button>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                ล้าง
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-slate-600 mt-2">
              กำลังค้นหา: <span className="font-semibold">"{searchQuery}"</span>
            </p>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value)
                  setCurrentPage(1)
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === tab.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Redemptions List */}
        {isLoading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 border-t-2 border-t-slate-200 mx-auto"></div>
            <p className="text-slate-600 mt-4">กำลังโหลด...</p>
          </div>
        ) : redemptions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-slate-200 shadow-sm">
            <HiOutlineGift className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">ไม่มีรายการแลกรางวัล</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {redemptions.map((redemption, index) => (
                <div
                  key={redemption.id}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:border-slate-300 hover:shadow-md transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex gap-4">
                    {/* Reward Image */}
                    <div className="flex-shrink-0">
                      <img
                        src={redemption.rewards.image_url || '/placeholder-reward.png'}
                        alt={redemption.rewards.name}
                        className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                      />
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header Row */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-slate-900 truncate">{redemption.rewards.name}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span className="text-blue-400 font-semibold">{formatPoints(redemption.points_used)}</span>
                            <span>×{redemption.quantity}</span>
                            <span>{formatDate(redemption.created_at, { includeTime: true })}</span>
                          </div>
                        </div>
                        <StatusBadge status={redemption.status} type="redemption" />
                      </div>

                      {/* User Info Row */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
                        <div className="flex items-center gap-1.5">
                          <FaUser className="text-slate-400 w-3 h-3" />
                          <span>{getUserDisplayName(redemption.user_profiles)}</span>
                        </div>
                        {redemption.user_profiles.phone && (
                          <div className="flex items-center gap-1.5">
                            <FaPhone className="text-slate-400 w-3 h-3" />
                            <span>{redemption.user_profiles.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* Admin Notes */}
                      {redemption.admin_notes && (
                        <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                          <span className="font-medium">หมายเหตุ:</span> {redemption.admin_notes}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {(redemption.status === 'requested' || redemption.status === 'processing') && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(redemption.id)}
                            disabled={processingId === redemption.id}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <HiCheckCircle className="w-4 h-4" />
                            อนุมัติ
                          </button>
                          <button
                            onClick={() => handleReject(redemption)}
                            disabled={processingId === redemption.id}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <HiXCircle className="w-4 h-4" />
                            ปฏิเสธ
                          </button>
                        </div>
                      )}

                      {/* Processed Info */}
                      {redemption.processed_at && (
                        <p className="text-xs text-slate-500 mt-2">
                          ดำเนินการเมื่อ: {formatDate(redemption.processed_at, { includeTime: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Reject Notes Modal */}
      {showNotesModal && selectedRedemption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">ปฏิเสธการแลกรางวัล</h3>
            <p className="text-slate-600 mb-4">
              คุณต้องการปฏิเสธการแลกรางวัล "{selectedRedemption.rewards.name}" หรือไม่?
              แต้มจะถูกคืนให้กับลูกค้า
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                เหตุผล (ไม่บังคับ)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="ระบุเหตุผลการปฏิเสธ..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmReject}
                disabled={processingId === selectedRedemption.id}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                ยืนยันปฏิเสธ
              </button>
              <button
                onClick={() => {
                  setShowNotesModal(false)
                  setSelectedRedemption(null)
                  setAdminNotes('')
                }}
                disabled={processingId === selectedRedemption.id}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
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
