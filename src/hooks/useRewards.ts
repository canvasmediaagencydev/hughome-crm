import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Tables } from '../../database.types'

export type Reward = Tables<'rewards'> & {
  is_archived?: boolean | null
  remaining_stock?: number | null
  redeemed_count?: number
}

interface RewardsResponse {
  rewards: Reward[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

async function getAuthHeaders() {
  const { supabaseAdmin } = await import('@/lib/supabase-admin')
  const { data: { session } } = await supabaseAdmin.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No session found')
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
}

async function fetchRewards(page: number): Promise<RewardsResponse> {
  const headers = await getAuthHeaders()
  const response = await fetch(`/api/admin/rewards?page=${page}&limit=12`, {
    headers,
  })

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized')
    if (response.status === 403) throw new Error('Forbidden')
    throw new Error('Failed to fetch rewards')
  }

  const data = await response.json()
  // Filter out archived rewards
  return {
    ...data,
    rewards: (data.rewards || []).filter((reward: Reward) => !reward.is_archived)
  }
}

interface CreateRewardParams {
  formData: FormData
}

async function createReward(params: CreateRewardParams) {
  const headers = await getAuthHeaders()
  // Remove Content-Type for FormData (browser sets it with boundary)
  delete (headers as any)['Content-Type']

  const response = await fetch('/api/admin/rewards', {
    method: 'POST',
    headers,
    body: params.formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create reward')
  }

  return response.json()
}

interface UpdateRewardParams {
  id: string
  formData: FormData
}

async function updateReward(params: UpdateRewardParams) {
  const headers = await getAuthHeaders()
  delete (headers as any)['Content-Type']

  const response = await fetch(`/api/admin/rewards/${params.id}`, {
    method: 'PUT',
    headers,
    body: params.formData
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update reward')
  }

  return response.json()
}

interface DeleteRewardParams {
  id: string
}

async function deleteReward(params: DeleteRewardParams) {
  const headers = await getAuthHeaders()

  const response = await fetch(`/api/admin/rewards/${params.id}`, {
    method: 'DELETE',
    headers
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete reward')
  }

  return response.json()
}

export function useRewards(initialPage: number = 1) {
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(initialPage)

  // Fetch rewards query
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['rewards', currentPage],
    queryFn: () => fetchRewards(currentPage),
    staleTime: 5 * 60 * 1000, // 5 minutes - rewards don't change often
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on window focus for rewards
    retry: 1,
  })

  const rewards = data?.rewards || []
  const pagination = data?.pagination || {
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0
  }

  // Handle errors
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลรางวัลได้'
    if (errorMessage.includes('Unauthorized')) {
      toast.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
    } else if (errorMessage.includes('Forbidden')) {
      toast.error('คุณไม่มีสิทธิ์ดูรางวัล')
    } else {
      toast.error(errorMessage)
    }
  }

  // Create reward mutation
  const createMutation = useMutation({
    mutationFn: createReward,
    onSuccess: () => {
      toast.success('สร้างรางวัลสำเร็จ!')
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการสร้างรางวัล')
    }
  })

  // Update reward mutation
  const updateMutation = useMutation({
    mutationFn: updateReward,
    onSuccess: () => {
      toast.success('อัปเดตรางวัลสำเร็จ!')
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการอัปเดตรางวัล')
    }
  })

  // Delete reward mutation
  const deleteMutation = useMutation({
    mutationFn: deleteReward,
    onSuccess: () => {
      toast.success('ลบรางวัลสำเร็จ!')
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบรางวัล')
    }
  })

  // Prefetch next page
  if (currentPage < pagination.totalPages) {
    queryClient.prefetchQuery({
      queryKey: ['rewards', currentPage + 1],
      queryFn: () => fetchRewards(currentPage + 1),
      staleTime: 5 * 60 * 1000,
    })
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return {
    rewards,
    loading: isLoading,
    pagination,
    currentPage,

    // Actions
    setCurrentPage: handlePageChange,
    refreshRewards: refetch,

    // Mutations
    createReward: (formData: FormData) => createMutation.mutateAsync({ formData }),
    updateReward: (id: string, formData: FormData) => updateMutation.mutateAsync({ id, formData }),
    deleteReward: (id: string) => deleteMutation.mutateAsync({ id }),

    // Mutation states
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    submitting: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  }
}
