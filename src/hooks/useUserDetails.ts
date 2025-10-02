import { useState, useCallback } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { UserDetails } from '@/types'

export function useUserDetails() {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  const fetchUserDetails = useCallback(async (
    userId: string,
    transactionPage: number = 1,
    redemptionPage: number = 1
  ) => {
    try {
      setLoadingDetails(true)
      const response = await axios.get(`/api/admin/users/${userId}`, {
        params: {
          transactionPage,
          transactionLimit: 5,
          redemptionPage,
          redemptionLimit: 3
        }
      })
      setUserDetails(response.data)
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('เกิดข้อผิดพลาดในการโหลดรายละเอียด')
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  const handleTransactionPageChange = useCallback(async (
    userId: string,
    newPage: number,
    currentRedemptionPage: number
  ) => {
    await fetchUserDetails(userId, newPage, currentRedemptionPage)
  }, [fetchUserDetails])

  const handleRedemptionPageChange = useCallback(async (
    userId: string,
    currentTransactionPage: number,
    newPage: number
  ) => {
    await fetchUserDetails(userId, currentTransactionPage, newPage)
  }, [fetchUserDetails])

  const clearUserDetails = useCallback(() => {
    setUserDetails(null)
  }, [])

  return {
    userDetails,
    loadingDetails,
    fetchUserDetails,
    handleTransactionPageChange,
    handleRedemptionPageChange,
    clearUserDetails
  }
}
