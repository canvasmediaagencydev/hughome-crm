'use client'

/**
 * /admin/redemptions — คำขอแลกรางวัล 4 สถานะ + ยกเลิก (Sprint 8, MIGRATION_PLAN.md §6.2)
 *
 *   requested → approved → ready → delivered   (PATCH :id/status ทีละขั้น)
 *        └────────┴─────────┴──→ cancelled     (POST :id/cancel → RPC คืนแต้ม+สต็อก · delivered แล้วห้าม)
 *
 * ส่งมอบของทำได้ 2 ทาง: กดปุ่ม "ส่งมอบแล้ว" ที่นี่ หรือสแกน QR ของลูกค้าที่ /admin/redemptions/scan
 */
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { HiOutlineGift, HiCheckCircle, HiXCircle, HiSearch, HiOutlineQrcode, HiOutlineCube } from 'react-icons/hi'
import { Shield } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { FaUser, FaPhone } from 'react-icons/fa'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { formatDate, formatPoints, getUserDisplayName } from '@/lib/utils'
import { axiosAdmin } from '@/lib/axios-admin'
import { toast } from 'sonner'
import {
  NEXT_STATUS,
  REDEMPTION_STATUS_LABEL,
  REDEMPTION_STATUSES,
  isCancellable,
  type RedemptionStatus,
} from '@/lib/redemption-status'

interface Redemption {
  id: string
  created_at: string
  points_used: number
  quantity: number
  status: RedemptionStatus
  pickup_code: string | null
  admin_notes: string | null
  processed_at: string | null
  delivered_at: string | null
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

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

const NEXT_BUTTON: Record<RedemptionStatus, { label: string; className: string } | null> = {
  requested: { label: 'อนุมัติ', className: 'bg-green-600 hover:bg-green-700' },
  approved: { label: 'ของพร้อมรับ', className: 'bg-blue-600 hover:bg-blue-700' },
  ready: { label: 'ส่งมอบแล้ว', className: 'bg-slate-900 hover:bg-slate-800' },
  delivered: null,
  cancelled: null,
}

export default function AdminRedemptionsPage() {
  const { hasPermission, loading: authLoading } = useAdminAuth()

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

  const fetchRedemptions = useCallback(async (page: number, status: string, search: string) => {
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
  }, [])

  useEffect(() => {
    if (authLoading) return
    fetchRedemptions(currentPage, statusFilter, searchQuery)
  }, [authLoading, currentPage, statusFilter, searchQuery, fetchRedemptions])

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
  const canDeliver = hasPermission(PERMISSIONS.REDEMPTIONS_DELIVER)

  const canAdvanceHere = (status: RedemptionStatus) =>
    NEXT_STATUS[status] === 'delivered' ? canDeliver : canProcess

  const handleAdvance = async (redemption: Redemption) => {
    const next = NEXT_STATUS[redemption.status]
    if (!next) return
    try {
      setProcessingId(redemption.id)
      await axiosAdmin.patch(`/api/admin/redemptions/${redemption.id}/status`, { status: next })
      toast.success(`เปลี่ยนเป็น "${REDEMPTION_STATUS_LABEL[next]}" แล้ว`)
      fetchRedemptions(currentPage, statusFilter, searchQuery)
    } catch (error) {
      toast.error(errorMessage(error, 'เปลี่ยนสถานะไม่สำเร็จ'))
      fetchRedemptions(currentPage, statusFilter, searchQuery)
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
      const { data } = await axiosAdmin.post(`/api/admin/redemptions/${selectedRedemption.id}/cancel`, { adminNotes })
      toast.success(
        `ยกเลิกแล้ว · คืนแต้มให้ลูกค้า — ยอดคงเหลือ ${typeof data?.newBalance === 'number' ? formatPoints(data.newBalance) : '-'}`
      )
      setShowNotesModal(false)
      setSelectedRedemption(null)
      setAdminNotes('')
      fetchRedemptions(currentPage, statusFilter, searchQuery)
    } catch (error) {
      toast.error(errorMessage(error, 'ยกเลิกไม่สำเร็จ'))
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
    if (e.key === 'Enter') handleSearch()
  }

  const statusTabs = [
    { value: 'all', label: 'ทั้งหมด' },
    ...REDEMPTION_STATUSES.map((s) => ({ value: s, label: REDEMPTION_STATUS_LABEL[s] })),
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">คำขอแลกรางวัล</h1>
            <p className="text-sm text-slate-500 mt-1">
              รอดำเนินการ → อนุมัติแล้ว → พร้อมรับของ → รับของแล้ว · ยกเลิกได้จนถึง &quot;พร้อมรับของ&quot;
            </p>
          </div>
          {canDeliver && (
            <Link
              href="/admin/redemptions/scan"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
            >
              <HiOutlineQrcode className="w-5 h-5" /> สแกน QR รับของ
            </Link>
          )}
        </div>

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
              กำลังค้นหา: <span className="font-semibold">&quot;{searchQuery}&quot;</span>
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
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === tab.value
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
              {redemptions.map((redemption, index) => {
                const nextBtn = NEXT_BUTTON[redemption.status]
                const busy = processingId === redemption.id
                return (
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
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-slate-900 truncate">{redemption.rewards.name}</h3>
                            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                              <span className="text-blue-500 font-semibold">{formatPoints(redemption.points_used)}</span>
                              <span>×{redemption.quantity}</span>
                              <span>{formatDate(redemption.created_at, { includeTime: true })}</span>
                              {redemption.pickup_code && (
                                <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                                  <HiOutlineQrcode className="w-3.5 h-3.5" /> {redemption.pickup_code}
                                </span>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={redemption.status} type="redemption" />
                        </div>

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

                        {redemption.admin_notes && (
                          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            <span className="font-medium">หมายเหตุ:</span> {redemption.admin_notes}
                          </div>
                        )}

                        {/* Action Buttons */}
                        {(nextBtn || isCancellable(redemption.status)) && (
                          <div className="flex flex-wrap gap-2">
                            {nextBtn && canAdvanceHere(redemption.status) && (
                              <button
                                onClick={() => handleAdvance(redemption)}
                                disabled={busy}
                                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${nextBtn.className}`}
                              >
                                {redemption.status === 'approved' ? (
                                  <HiOutlineCube className="w-4 h-4" />
                                ) : (
                                  <HiCheckCircle className="w-4 h-4" />
                                )}
                                {nextBtn.label}
                              </button>
                            )}
                            {isCancellable(redemption.status) && canProcess && (
                              <button
                                onClick={() => handleReject(redemption)}
                                disabled={busy}
                                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <HiXCircle className="w-4 h-4" />
                                ยกเลิก (คืนแต้ม)
                              </button>
                            )}
                          </div>
                        )}

                        {(redemption.processed_at || redemption.delivered_at) && (
                          <p className="text-xs text-slate-500 mt-2">
                            {redemption.processed_at && <>อนุมัติเมื่อ: {formatDate(redemption.processed_at, { includeTime: true })}</>}
                            {redemption.processed_at && redemption.delivered_at && ' · '}
                            {redemption.delivered_at && <>ส่งมอบเมื่อ: {formatDate(redemption.delivered_at, { includeTime: true })}</>}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
            )}
          </>
        )}
      </div>

      {/* Cancel Modal */}
      {showNotesModal && selectedRedemption && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg border border-slate-200 shadow-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">ยกเลิกการแลกรางวัล</h3>
            <p className="text-slate-600 mb-4">
              ยกเลิก &quot;{selectedRedemption.rewards.name}&quot; ของ {getUserDisplayName(selectedRedemption.user_profiles)}?
              แต้ม {formatPoints(selectedRedemption.points_used)} จะคืนเข้าก้อนเดิมของลูกค้า และคืนสต็อกของรางวัล
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">เหตุผล (ไม่บังคับ)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="ระบุเหตุผลการยกเลิก..."
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
                ยืนยันยกเลิก
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
                กลับ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
