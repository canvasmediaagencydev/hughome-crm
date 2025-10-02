import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { ReceiptWithRelations } from '@/types'

export function useReceiptActions(onSuccess?: () => void) {
  const [processing, setProcessing] = useState<string | null>(null)
  const [autoApproving, setAutoApproving] = useState(false)
  const [autoRejecting, setAutoRejecting] = useState(false)

  const approveReceipt = useCallback(async (
    receipt: ReceiptWithRelations,
    pointsAwarded: number
  ) => {
    setProcessing(receipt.id)
    try {
      const response = await fetch(`/api/admin/receipts/${receipt.id}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points_awarded: pointsAwarded,
          admin_notes: 'อนุมัติโดยระบบ'
        })
      })

      if (response.ok) {
        toast.success('อนุมัติใบเสร็จสำเร็จ!')
        onSuccess?.()
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
        return false
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติ')
      return false
    } finally {
      setProcessing(null)
    }
  }, [onSuccess])

  const rejectReceipt = useCallback(async (
    receiptId: string,
    reason: string
  ) => {
    setProcessing(receiptId)
    try {
      const response = await fetch(`/api/admin/receipts/${receiptId}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_notes: reason
        })
      })

      if (response.ok) {
        toast.success('ปฏิเสธใบเสร็จสำเร็จ!')
        onSuccess?.()
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
        return false
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการปฏิเสธ')
      return false
    } finally {
      setProcessing(null)
    }
  }, [onSuccess])

  const autoApproveReceipts = useCallback(async () => {
    setAutoApproving(true)
    try {
      const response = await fetch('/api/admin/receipts/auto-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`อนุมัติสำเร็จ ${result.approved_count} ใบเสร็จ`)
        if (result.error_count > 0) {
          toast.warning(`มีข้อผิดพลาด ${result.error_count} รายการ`)
        }
        onSuccess?.()
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
        return false
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอนุมัติอัตโนมัติ')
      return false
    } finally {
      setAutoApproving(false)
    }
  }, [onSuccess])

  const autoRejectReceipts = useCallback(async () => {
    setAutoRejecting(true)
    try {
      const response = await fetch('/api/admin/receipts/auto-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`ปฏิเสธสำเร็จ ${result.rejected_count} ใบเสร็จ`)
        if (result.error_count > 0) {
          toast.warning(`มีข้อผิดพลาด ${result.error_count} รายการ`)
        }
        onSuccess?.()
        return true
      } else {
        const error = await response.json()
        toast.error(error.error || 'เกิดข้อผิดพลาด')
        return false
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการปฏิเสธอัตโนมัติ')
      return false
    } finally {
      setAutoRejecting(false)
    }
  }, [onSuccess])

  return {
    processing,
    autoApproving,
    autoRejecting,
    approveReceipt,
    rejectReceipt,
    autoApproveReceipts,
    autoRejectReceipts
  }
}
