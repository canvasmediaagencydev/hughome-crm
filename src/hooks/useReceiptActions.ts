import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import { ReceiptWithRelations } from '@/types'



interface ApproveReceiptParams {
  receipt: ReceiptWithRelations
  pointsAwarded: number
}

async function approveReceiptFn(params: ApproveReceiptParams) {
  const response = await axiosAdmin.put(`/api/admin/receipts/${params.receipt.id}/approve`, {
    points_awarded: params.pointsAwarded,
    admin_notes: 'อนุมัติโดยระบบ'
  })
  return response.data
}

interface RejectReceiptParams {
  receiptId: string
  reason: string
}

async function rejectReceiptFn(params: RejectReceiptParams) {
  const response = await axiosAdmin.put(`/api/admin/receipts/${params.receiptId}/reject`, {
    admin_notes: params.reason
  })
  return response.data
}

async function autoApproveReceiptsFn() {
  const response = await axiosAdmin.post('/api/admin/receipts/auto-approve')
  return response.data
}

async function autoRejectReceiptsFn() {
  const response = await axiosAdmin.post('/api/admin/receipts/auto-reject')
  return response.data
}

export function useReceiptActions(onSuccess?: () => void) {
  const queryClient = useQueryClient()

  // Approve single receipt mutation
  const approveMutation = useMutation({
    mutationFn: approveReceiptFn,
    onSuccess: () => {
      toast.success('อนุมัติใบเสร็จสำเร็จ!')
      // Invalidate and refetch receipts queries
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      if (error.message.includes('No session')) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
      } else {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการอนุมัติ')
      }
    }
  })

  // Reject single receipt mutation
  const rejectMutation = useMutation({
    mutationFn: rejectReceiptFn,
    onSuccess: () => {
      toast.success('ปฏิเสธใบเสร็จสำเร็จ!')
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      if (error.message.includes('No session')) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
      } else {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการปฏิเสธ')
      }
    }
  })

  // Auto approve mutation
  const autoApproveMutation = useMutation({
    mutationFn: autoApproveReceiptsFn,
    onSuccess: (result) => {
      toast.success(`อนุมัติสำเร็จ ${result.approved_count} ใบเสร็จ`)
      if (result.error_count > 0) {
        toast.warning(`มีข้อผิดพลาด ${result.error_count} รายการ`)
      }
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      if (error.message.includes('No session')) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
      } else {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการอนุมัติอัตโนมัติ')
      }
    }
  })

  // Auto reject mutation
  const autoRejectMutation = useMutation({
    mutationFn: autoRejectReceiptsFn,
    onSuccess: (result) => {
      toast.success(`ปฏิเสธสำเร็จ ${result.rejected_count} ใบเสร็จ`)
      if (result.error_count > 0) {
        toast.warning(`มีข้อผิดพลาด ${result.error_count} รายการ`)
      }
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      onSuccess?.()
    },
    onError: (error: Error) => {
      if (error.message.includes('No session')) {
        toast.error('ไม่พบ session กรุณา login ใหม่')
      } else {
        toast.error(error.message || 'เกิดข้อผิดพลาดในการปฏิเสธอัตโนมัติ')
      }
    }
  })

  return {
    // For backward compatibility with existing code
    processing: approveMutation.isPending || rejectMutation.isPending
      ? 'processing'
      : null,
    autoApproving: autoApproveMutation.isPending,
    autoRejecting: autoRejectMutation.isPending,

    // Mutation functions
    approveReceipt: (receipt: ReceiptWithRelations, pointsAwarded: number) =>
      approveMutation.mutateAsync({ receipt, pointsAwarded }),
    rejectReceipt: (receiptId: string, reason: string) =>
      rejectMutation.mutateAsync({ receiptId, reason }),
    autoApproveReceipts: () => autoApproveMutation.mutateAsync(),
    autoRejectReceipts: () => autoRejectMutation.mutateAsync(),
  }
}
