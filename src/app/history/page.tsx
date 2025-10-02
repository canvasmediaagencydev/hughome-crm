'use client'

import { useState, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import { FaClock, FaMoneyBillWave, FaHistory } from "react-icons/fa"
import { HiOutlineGift } from "react-icons/hi"
import { UserSessionManager } from '@/lib/user-session'
import BottomNavigation from '@/components/BottomNavigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { formatDate, formatCurrency, formatPoints } from '@/lib/utils'
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


const ReceiptCard = memo(({ receipt }: { receipt: Receipt }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center text-gray-500 text-sm space-x-2">
          <FaClock className="w-4 h-4" />
          <span>{formatDate(receipt.created_at, { includeTime: true })}</span>
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
            {formatCurrency(receipt.total_amount || 0)}
          </p>
        </div>

        <div>
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <HiOutlineGift className="w-3 h-3" />
            <span>แต้มที่จะได้รับ</span>
          </div>
          <p className={`font-semibold ${receipt.status === 'approved' ? 'text-green-600' : receipt.status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
            {receipt.points_awarded ? formatPoints(receipt.points_awarded) :
             receipt.status === 'rejected' ? formatPoints(0) : 'รอการอนุมัติ'}
          </p>
        </div>
      </div>
    </div>
  )
})
ReceiptCard.displayName = 'ReceiptCard'



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
          <EmptyState
            icon={<FaHistory className="w-10 h-10 text-gray-400" />}
            title="ยังไม่มีประวัติใบเสร็จ"
            description="เริ่มอัพโหลดใบเสร็จเพื่อสะสมแต้มกันเลย"
            className="py-16"
          />
        ) : (
          <>
            {receipts.map((receipt) => (
              <ReceiptCard key={receipt.id} receipt={receipt} />
            ))}

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

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="history" />
    </div>
  )
}
