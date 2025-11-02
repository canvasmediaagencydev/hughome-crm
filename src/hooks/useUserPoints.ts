import { useState, useCallback } from 'react'
import { axiosAdmin as axios } from '@/lib/axios-admin'
import { toast } from 'sonner'

export function useUserPoints() {
  const [pointsAmount, setPointsAmount] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [pointsAction, setPointsAction] = useState<'add' | 'deduct'>('add')
  const [processingPoints, setProcessingPoints] = useState(false)

  const adjustPoints = useCallback(async (
    userId: string,
    onSuccess?: () => void
  ) => {
    if (!pointsAmount || !pointsReason.trim()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return false
    }

    const amount = parseFloat(pointsAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนแต้มที่มากกว่า 0')
      return false
    }

    const finalAmount = pointsAction === 'add' ? amount : -amount
    const transactionType = pointsAction === 'add' ? 'bonus' : 'spent'

    try {
      setProcessingPoints(true)
      await axios.post(`/api/admin/users/${userId}/points`, {
        amount: finalAmount,
        reason: pointsReason,
        type: transactionType
      })

      toast.success(`${pointsAction === 'add' ? 'เพิ่ม' : 'ลด'}แต้มสำเร็จ`)

      // Reset form
      setPointsAmount('')
      setPointsReason('')
      setPointsAction('add')

      onSuccess?.()
      return true
    } catch (error: any) {
      console.error('Error adjusting points:', error)
      toast.error(error.response?.data?.error || 'เกิดข้อผิดพลาดในการปรับแต้ม')
      return false
    } finally {
      setProcessingPoints(false)
    }
  }, [pointsAmount, pointsReason, pointsAction])

  const resetPointsForm = useCallback(() => {
    setPointsAmount('')
    setPointsReason('')
    setPointsAction('add')
  }, [])

  return {
    pointsAmount,
    setPointsAmount,
    pointsReason,
    setPointsReason,
    pointsAction,
    setPointsAction,
    processingPoints,
    adjustPoints,
    resetPointsForm
  }
}
