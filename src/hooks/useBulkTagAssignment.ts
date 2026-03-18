import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'

export function useBulkTagAssignment() {
  const queryClient = useQueryClient()
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const toggleUser = useCallback((id: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids: string[]) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedUserIds(new Set())
  }, [])

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
    setSelectedUserIds(new Set())
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedUserIds(new Set())
  }, [])

  const { mutateAsync: assignTagMutation, isPending: isAssigning } = useMutation({
    mutationFn: async ({ tagId, action }: { tagId: string; action: 'add' | 'remove' }) => {
      const response = await axiosAdmin.post('/api/admin/users/bulk-tags', {
        user_ids: Array.from(selectedUserIds),
        tag_id: tagId,
        action,
      })
      return response.data
    },
    onSuccess: (_, { action }) => {
      toast.success(action === 'add' ? 'เพิ่ม Tag สำเร็จ' : 'ลบ Tag สำเร็จ')
      queryClient.invalidateQueries({ queryKey: ['users'] })
      clearSelection()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'เกิดข้อผิดพลาด')
    },
  })

  const assignTag = useCallback(
    (tagId: string, action: 'add' | 'remove') => assignTagMutation({ tagId, action }),
    [assignTagMutation]
  )

  return {
    selectedUserIds,
    toggleUser,
    selectAll,
    clearSelection,
    isSelectionMode,
    enterSelectionMode,
    exitSelectionMode,
    assignTag,
    isAssigning,
  }
}
