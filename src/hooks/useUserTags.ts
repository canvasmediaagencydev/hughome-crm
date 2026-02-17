import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { axiosAdmin } from '@/lib/axios-admin'
import { Tag } from '@/types'
import { toast } from 'sonner'

async function fetchUserTags(userId: string): Promise<Tag[]> {
  const response = await axiosAdmin.get(`/api/admin/users/${userId}/tags`)
  return response.data.tags
}

export function useUserTags(userId: string | null) {
  return useQuery({
    queryKey: ['userTags', userId],
    queryFn: () => fetchUserTags(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  })
}

export function useAddUserTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, tagId }: { userId: string; tagId: string }) => {
      await axiosAdmin.post(`/api/admin/users/${userId}/tags`, { tag_id: tagId })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userTags', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('เพิ่ม Tag สำเร็จ')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'ไม่สามารถเพิ่ม Tag ได้'
      toast.error(message)
    },
  })
}

export function useRemoveUserTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, tagId }: { userId: string; tagId: string }) => {
      await axiosAdmin.delete(`/api/admin/users/${userId}/tags`, {
        data: { tag_id: tagId },
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['userTags', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('ลบ Tag สำเร็จ')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'ไม่สามารถลบ Tag ได้'
      toast.error(message)
    },
  })
}
