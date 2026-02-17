import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { axiosAdmin } from '@/lib/axios-admin'
import { Tag } from '@/types'
import { toast } from 'sonner'

async function fetchTags(): Promise<Tag[]> {
  const response = await axiosAdmin.get('/api/admin/tags')
  return response.data.tags
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: fetchTags,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const response = await axiosAdmin.post('/api/admin/tags', data)
      return response.data.tag
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('สร้าง Tag สำเร็จ')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'ไม่สามารถสร้าง Tag ได้'
      toast.error(message)
    },
  })
}

export function useUpdateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string }) => {
      const response = await axiosAdmin.put(`/api/admin/tags/${id}`, data)
      return response.data.tag
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      toast.success('แก้ไข Tag สำเร็จ')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'ไม่สามารถแก้ไข Tag ได้'
      toast.error(message)
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await axiosAdmin.delete(`/api/admin/tags/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('ลบ Tag สำเร็จ')
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'ไม่สามารถลบ Tag ได้'
      toast.error(message)
    },
  })
}
