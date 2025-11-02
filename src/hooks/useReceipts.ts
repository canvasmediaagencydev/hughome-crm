import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { ReceiptWithRelations, ReceiptListResponse } from '@/types'
import debounce from 'lodash.debounce'

interface UseReceiptsParams {
  initialStatus?: string
  initialPage?: number
  initialSearch?: string
}

export function useReceipts(params: UseReceiptsParams = {}) {
  const {
    initialStatus = 'pending',
    initialPage = 1,
    initialSearch = ''
  } = params

  const [receipts, setReceipts] = useState<ReceiptWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState(initialStatus)
  const [search, setSearch] = useState(initialSearch)
  const [page, setPage] = useState(initialPage)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchReceipts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status,
        page: page.toString(),
        limit: '20'
      })

      if (search.trim()) {
        params.append('search', search.trim())
      }

      const { supabaseAdmin } = await import('@/lib/supabase-admin')
      const { data: { session } } = await supabaseAdmin.auth.getSession()

      if (!session?.access_token) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/admin/receipts?${params}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      if (response.ok) {
        const data: ReceiptListResponse = await response.json()
        setReceipts(data.receipts)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch receipts:', error)
      toast.error('ไม่สามารถโหลดข้อมูลใบเสร็จได้')
    } finally {
      setLoading(false)
    }
  }, [status, page, search])

  // Create debounced version that updates when fetchReceipts changes
  const debouncedFetchReceipts = useMemo(
    () => debounce(fetchReceipts, 1000),
    [fetchReceipts]
  )

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedFetchReceipts.cancel()
    }
  }, [debouncedFetchReceipts])

  // Fetch on mount
  useEffect(() => {
    fetchReceipts()
  }, [])

  // Fetch immediately when status or page changes (not search)
  const prevStatusRef = useRef(status)
  const prevPageRef = useRef(page)

  useEffect(() => {
    if (prevStatusRef.current !== status || prevPageRef.current !== page) {
      fetchReceipts()
      prevStatusRef.current = status
      prevPageRef.current = page
    }
  }, [status, page, fetchReceipts])

  // Debounced fetch when search changes
  const prevSearchRef = useRef(search)

  useEffect(() => {
    if (prevSearchRef.current !== search) {
      debouncedFetchReceipts()
      prevSearchRef.current = search
    }
  }, [search, debouncedFetchReceipts])

  const handleSearch = useCallback(() => {
    setPage(1)
    fetchReceipts()
  }, [fetchReceipts])

  const handleStatusChange = useCallback((newStatus: string) => {
    setStatus(newStatus)
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const refreshReceipts = useCallback(() => {
    fetchReceipts()
  }, [fetchReceipts])

  return {
    receipts,
    loading,
    status,
    search,
    page,
    pagination,
    setSearch,
    setStatus: handleStatusChange,
    setPage: handlePageChange,
    handleSearch,
    refreshReceipts
  }
}
