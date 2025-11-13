import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ReceiptWithRelations, ReceiptListResponse } from '@/types'
import debounce from 'lodash.debounce'

interface UseReceiptsParams {
  initialStatus?: string
  initialPage?: number
  initialSearch?: string
}

async function fetchReceipts(
  status: string,
  page: number,
  search: string
): Promise<ReceiptListResponse> {
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
    throw new Error('No session found')
  }

  const response = await fetch(`/api/admin/receipts?${params}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`
    }
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Session expired')
    }
    if (response.status === 403) {
      throw new Error('Forbidden: No permission to view receipts')
    }
    throw new Error('Failed to fetch receipts')
  }

  return response.json()
}

export function useReceipts(params: UseReceiptsParams = {}) {
  const {
    initialStatus = 'pending',
    initialPage = 1,
    initialSearch = ''
  } = params

  const queryClient = useQueryClient()
  const [status, setStatus] = useState(initialStatus)
  const [search, setSearch] = useState(initialSearch)
  const [page, setPage] = useState(initialPage)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)

  // Debounce search input (300ms instead of 1000ms for better UX)
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value)
      setPage(1) // Reset to first page on search
    }, 300),
    []
  )

  // Update debounced search when search changes
  useMemo(() => {
    debouncedSetSearch(search)
  }, [search, debouncedSetSearch])

  // Main receipts query with React Query
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['receipts', status, page, debouncedSearch],
    queryFn: () => fetchReceipts(status, page, debouncedSearch),
    staleTime: 1 * 60 * 1000, // 1 minute - receipts update frequently
    gcTime: 3 * 60 * 1000, // Keep in cache for 3 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })

  const receipts = data?.receipts || []
  const pagination = data?.pagination || {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  }

  // Handle errors
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลใบเสร็จได้'

    if (errorMessage.includes('Unauthorized')) {
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    } else if (errorMessage.includes('Forbidden')) {
      toast.error('คุณไม่มีสิทธิ์ดูใบเสร็จ')
    } else {
      toast.error(errorMessage)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus)
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleSearch = () => {
    setDebouncedSearch(search)
    setPage(1)
  }

  const refreshReceipts = () => {
    refetch()
  }

  // Prefetch next page for better UX
  if (page < pagination.totalPages) {
    queryClient.prefetchQuery({
      queryKey: ['receipts', status, page + 1, debouncedSearch],
      queryFn: () => fetchReceipts(status, page + 1, debouncedSearch),
      staleTime: 1 * 60 * 1000,
    })
  }

  return {
    receipts,
    loading: isLoading,
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
