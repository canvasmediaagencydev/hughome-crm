import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
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

async function fetchRewards(page: number): Promise<RewardsResponse> {
  const response = await axiosAdmin.get(`/api/admin/rewards?page=${page}&limit=12`)
  const data = response.data
  
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
  // axios will automatically set Content-Type to multipart/form-data when body is FormData
  const response = await axiosAdmin.post('/api/admin/rewards', params.formData)
  return response.data
}

interface UpdateRewardParams {
  id: string
  formData: FormData
}

async function updateReward(params: UpdateRewardParams) {
  const response = await axiosAdmin.put(`/api/admin/rewards/${params.id}`, params.formData)
  return response.data
}

interface DeleteRewardParams {
  id: string
}

async function deleteReward(params: DeleteRewardParams) {
  const response = await axiosAdmin.delete(`/api/admin/rewards/${params.id}`)
  return response.data
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
