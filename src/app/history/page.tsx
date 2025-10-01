'use client'

import { useState, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import { IoMdArrowBack, IoMdArrowForward } from "react-icons/io"
import { FaClock, FaMoneyBillWave, FaHistory } from "react-icons/fa"
import { HiOutlineGift } from "react-icons/hi"
import { UserSessionManager } from '@/lib/user-session'
import BottomNavigation from '@/components/BottomNavigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import axios from 'axios'

interface Receipt {
  id: string
  created_at: string
  total_amount: number
  points_awarded: number | null
  status: 'pending' | 'approved' | 'rejected'
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const StatusBadge = memo(({ status }: { status: string }) => {
  const statusConfig = {
    pending: { text: 'รออนุมัติ', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
    approved: { text: 'อนุมัติแล้ว', color: 'bg-green-100 text-green-700 border-green-300' },
    rejected: { text: 'ถูกปฏิเสธ', color: 'bg-red-100 text-red-700 border-red-300' }
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${config.color}`}>
      {config.text}
    </span>
  )
})
StatusBadge.displayName = 'StatusBadge'

const ReceiptCard = memo(({ receipt }: { receipt: Receipt }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center text-gray-500 text-sm space-x-2">
          <FaClock className="w-4 h-4" />
          <span>{formatDate(receipt.created_at)}</span>
        </div>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
        <div>
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <FaMoneyBillWave className="w-3 h-3" />
            <span>ยอดเงิน</span>
          </div>
          <p className="text-gray-900 font-semibold">
            ฿{receipt.total_amount?.toLocaleString() || '0'}
          </p>
        </div>

        <div>
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <HiOutlineGift className="w-3 h-3" />
            <span>แต้มที่จะได้รับ</span>
          </div>
          <p className={`font-semibold ${receipt.status === 'approved' ? 'text-green-600' : receipt.status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
            {receipt.points_awarded ? `${receipt.points_awarded.toLocaleString()} แต้ม` :
             receipt.status === 'rejected' ? '0 แต้ม' : 'รอการอนุมัติ'}
          </p>
        </div>
      </div>
    </div>
  )
})
ReceiptCard.displayName = 'ReceiptCard'


const PaginationControls = memo(({
  currentPage,
  totalPages,
  onPageChange
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) => {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center space-x-2 py-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`p-2 rounded-lg transition-colors ${
          currentPage === 1
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200'
        }`}
      >
        <IoMdArrowBack className="w-5 h-5" />
      </button>

      <div className="flex items-center space-x-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === page
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200'
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`p-2 rounded-lg transition-colors ${
          currentPage === totalPages
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200'
        }`}
      >
        <IoMdArrowForward className="w-5 h-5" />
      </button>
    </div>
  )
})
PaginationControls.displayName = 'PaginationControls'

export default function HistoryPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const router = useRouter()

  const fetchHistory = async (page: number) => {
    try {
      setIsLoading(true)
      const cachedSession = UserSessionManager.getCachedSession()
      if (!cachedSession?.user?.id) {
        router.push('/')
        return
      }

      const response = await axios.post('/api/receipts/history', {
        userId: cachedSession.user.id,
        page,
        limit: 4
      })

      if (response.data.success) {
        setReceipts(response.data.receipts)
        setPagination(response.data.pagination)
      }
    } catch (error) {
      console.error('Error fetching receipt history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory(currentPage)
  }, [currentPage, router])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (isLoading) {
    return <LoadingSpinner message="กำลังโหลดประวัติ..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Content */}
      <div className="p-4 space-y-3">
        {receipts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaHistory className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-500 text-lg font-medium mb-2">ยังไม่มีประวัติใบเสร็จ</p>
            <p className="text-gray-400 text-sm">เริ่มอัพโหลดใบเสร็จเพื่อสะสมแต้มกันเลย</p>
          </div>
        ) : (
          <>
            {receipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}

            {/* Pagination */}
            {pagination && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="history" />
    </div>
  )
}
