import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import debounce from 'lodash.debounce'

export interface Redemption {
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

interface RedemptionsResponse {
  redemptions: Redemption[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

async function fetchRedemptions(
  page: number,
  status: string,
  search: string
): Promise<RedemptionsResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '10',
    status,
  })

  if (search.trim()) {
    params.append('search', search.trim())
  }

  const response = await axiosAdmin.get(`/api/admin/redemptions?${params}`)
  return response.data
}

interface CompleteRedemptionParams {
  id: string
  notes?: string
}

async function completeRedemption(params: CompleteRedemptionParams) {
  const response = await axiosAdmin.put(`/api/admin/redemptions/${params.id}/complete`, {
    admin_notes: params.notes || ''
  })
  return response.data
}

interface CancelRedemptionParams {
  id: string
  notes?: string
}

async function cancelRedemption(params: CancelRedemptionParams) {
  const response = await axiosAdmin.put(`/api/admin/redemptions/${params.id}/cancel`, {
    admin_notes: params.notes || ''
  })
  return response.data
}

interface UseRedemptionsParams {
  initialPage?: number
  initialStatus?: string
  initialSearch?: string
}

export function useRedemptions(params: UseRedemptionsParams = {}) {
  const {
    initialPage = 1,
    initialStatus = 'all',
    initialSearch = ''
  } = params

  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)

  // Debounce search input (300ms)
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value)
      setCurrentPage(1) // Reset to first page on search
    }, 300),
    []
  )

  // Update debounced search when search changes
  useMemo(() => {
    debouncedSetSearch(searchInput)
  }, [searchInput, debouncedSetSearch])

  // Main redemptions query
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['redemptions', currentPage, statusFilter, debouncedSearch],
    queryFn: () => fetchRedemptions(currentPage, statusFilter, debouncedSearch),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // Keep in cache for 3 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })

  const redemptions = data?.redemptions || []
  const pagination = data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  }

  // Handle errors
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'ไม่สามารถโหลดคำขอแลกรางวัลได้'
    if (errorMessage.includes('Unauthorized')) {
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    } else if (errorMessage.includes('Forbidden')) {
      toast.error('คุณไม่มีสิทธิ์ดูการแลกรางวัล')
    } else {
      toast.error(errorMessage)
    }
  }

  // Complete redemption mutation
  const completeMutation = useMutation({
    mutationFn: completeRedemption,
    onSuccess: () => {
      toast.success('ทำรายการสำเร็จ!')
      queryClient.invalidateQueries({ queryKey: ['redemptions'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด')
    }
  })

  // Cancel redemption mutation
  const cancelMutation = useMutation({
    mutationFn: cancelRedemption,
    onSuccess: () => {
      toast.success('ยกเลิกสำเร็จ!')
      queryClient.invalidateQueries({ queryKey: ['redemptions'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด')
    }
  })

  // Prefetch next page
  if (currentPage < pagination.totalPages) {
    queryClient.prefetchQuery({
      queryKey: ['redemptions', currentPage + 1, statusFilter, debouncedSearch],
      queryFn: () => fetchRedemptions(currentPage + 1, statusFilter, debouncedSearch),
      staleTime: 1 * 60 * 1000,
    })
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus)
    setCurrentPage(1)
  }

  const handleSearch = () => {
    setDebouncedSearch(searchInput)
    setCurrentPage(1)
  }

  return {
    redemptions,
    loading: isLoading,
    pagination,
    currentPage,
    statusFilter,
    searchInput,

    // Actions
    setCurrentPage: handlePageChange,
    setStatusFilter: handleStatusChange,
    setSearchInput,
    handleSearch,
    refreshRedemptions: refetch,

    // Mutations
    completeRedemption: (id: string, notes?: string) =>
      completeMutation.mutateAsync({ id, notes }),
    cancelRedemption: (id: string, notes?: string) =>
      cancelMutation.mutateAsync({ id, notes }),

    // Mutation states
    processingId: completeMutation.isPending || cancelMutation.isPending
      ? 'processing'
      : null,
    isProcessing: completeMutation.isPending || cancelMutation.isPending,
  }
}
