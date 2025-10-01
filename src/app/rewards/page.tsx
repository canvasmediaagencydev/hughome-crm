'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tables } from '../../../database.types'
import { toast } from 'sonner'
import Image from 'next/image'
import { UserSessionManager } from '@/lib/user-session'
import { useRouter } from 'next/navigation'
import { FaHistory } from "react-icons/fa"
import { HiOutlineGift } from "react-icons/hi"
import BottomNavigation from '@/components/BottomNavigation'
import LoadingSpinner from '@/components/LoadingSpinner'

type Reward = Tables<'rewards'> & {
  remaining_stock?: number | null
  is_available?: boolean
}

type Redemption = Tables<'redemptions'> & {
  rewards: {
    id: string
    name: string
    description: string | null
    image_url: string | null
    points_cost: number
  } | null
}

export default function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRewards, setLoadingRewards] = useState(true)
  const [loadingRedemptions, setLoadingRedemptions] = useState(true)
  const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards')
  const [showRedeemDialog, setShowRedeemDialog] = useState(false)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [userPoints, setUserPoints] = useState(0)
  const [userId, setUserId] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const cachedSession = UserSessionManager.getCachedSession()
    if (!cachedSession?.user?.id) {
      router.push('/')
      return
    }

    setUserId(cachedSession.user.id)
    setUserPoints(cachedSession.user.points_balance || 0)

    fetchRewards()
    fetchRedemptions(cachedSession.user.id)
  }, [router])

  const fetchRewards = async () => {
    try {
      setLoadingRewards(true)
      const response = await fetch('/api/rewards')
      if (response.ok) {
        const data = await response.json()
        setRewards(data)
      } else {
        toast.error('ไม่สามารถโหลดข้อมูลรางวัลได้')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoadingRewards(false)
    }
  }

  const fetchRedemptions = async (uid: string) => {
    try {
      setLoadingRedemptions(true)
      const response = await fetch(`/api/redemptions?userId=${uid}`)
      if (response.ok) {
        const data = await response.json()
        setRedemptions(data)
      }
    } catch (error) {
      console.error('Failed to fetch redemptions:', error)
    } finally {
      setLoadingRedemptions(false)
    }
  }

  useEffect(() => {
    if (userId) {
      setLoading(false)
    }
  }, [userId])

  const handleOpenRedeemDialog = (reward: Reward) => {
    setSelectedReward(reward)
    setShowRedeemDialog(true)
  }

  const handleRedeem = async () => {
    if (!selectedReward || !userId) return

    setSubmitting(true)
    try {
      const response = await fetch('/api/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          rewardId: selectedReward.id,
          quantity: 1,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('แลกรางวัลสำเร็จ!')
        setUserPoints(data.newBalance)

        // Update session with new points balance
        const cachedSession = UserSessionManager.getCachedSession()
        if (cachedSession) {
          UserSessionManager.updateUserData({
            ...cachedSession.user,
            points_balance: data.newBalance
          })
        }

        setShowRedeemDialog(false)
        fetchRewards()
        fetchRedemptions(userId)
      } else {
        toast.error(data.error || 'ไม่สามารถแลกรางวัลได้')
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      requested: {
        label: 'รับสินค้าที่ร้าน',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      },
      processing: {
        label: 'กำลังจัดเตรียม',
        className: 'bg-blue-100 text-blue-700 border-blue-300',
      },
      shipped: {
        label: 'จัดส่งแล้ว',
        className: 'bg-green-100 text-green-700 border-green-300',
      },
      cancelled: {
        label: 'ยกเลิก',
        className: 'bg-red-100 text-red-700 border-red-300',
      },
    }

    const variant = variants[status] || variants.requested

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${variant.className}`}>
        {variant.label}
      </span>
    )
  }

  if (loading) {
    return <LoadingSpinner message="กำลังโหลดรางวัล..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
     
      {/* Points Card */}
      <div className="px-4 pt-4">
        <div className="bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 rounded-2xl p-6 shadow-xl border border-gray-700/50 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-amber-500/10"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">แต้มคงเหลือ</p>
                <div className="text-white font-bold text-3xl">
                  {userPoints.toLocaleString()} <span className="text-lg text-amber-400">แต้ม</span>
                </div>
              </div>
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
                <HiOutlineGift className="w-8 h-8 text-amber-400" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 px-4 pt-4 pb-2">
        <button
          className={`px-4 py-2 font-medium transition-colors rounded-lg ${
            activeTab === 'rewards'
              ? 'bg-red-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('rewards')}
        >
          <HiOutlineGift className="inline mr-2 h-4 w-4" />
          รางวัลที่แลกได้
        </button>
        <button
          className={`px-4 py-2 font-medium transition-colors rounded-lg ${
            activeTab === 'history'
              ? 'bg-red-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => setActiveTab('history')}
        >
          <FaHistory className="inline mr-2 h-4 w-4" />
          ประวัติการแลก
        </button>
      </div>

      {/* Available Rewards */}
      {activeTab === 'rewards' && (
        <div className="px-4 py-4">
          {loadingRewards ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600">กำลังโหลดรางวัล...</p>
            </div>
          ) : rewards.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center">
              <HiOutlineGift className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">ยังไม่มีรางวัลที่พร้อมแลก</p>
            </div>
          ) : (
            <div className="space-y-4">
              {rewards.map((reward) => {
                const canAfford = userPoints >= reward.points_cost
                return (
                  <div key={reward.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex">
                      <div className="w-32 h-32 bg-gray-100 relative flex-shrink-0">
                        {reward.image_url ? (
                          <Image
                            src={reward.image_url}
                            alt={reward.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <HiOutlineGift className="h-12 w-12 text-gray-400" />
                          </div>
                        )}
                        {reward.remaining_stock !== null && reward.remaining_stock !== undefined && reward.remaining_stock < 10 && (
                          <div className="absolute top-2 right-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${
                              reward.remaining_stock === 0 ? 'bg-red-500' : 'bg-orange-500'
                            }`}>
                              {reward.remaining_stock} ชิ้น
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-4">
                        <h3 className="font-semibold text-gray-900 mb-1">{reward.name}</h3>
                        {reward.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{reward.description}</p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-red-600 font-bold text-lg">
                            <HiOutlineGift className="mr-1 h-5 w-5" />
                            {reward.points_cost.toLocaleString()} แต้ม
                          </div>
                          <Button
                            size="sm"
                            className={canAfford ? 'bg-red-600 hover:bg-red-700' : ''}
                            onClick={() => handleOpenRedeemDialog(reward)}
                            disabled={!canAfford}
                          >
                            {canAfford ? 'แลกเลย' : 'แต้มไม่พอ'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Redemption History */}
      {activeTab === 'history' && (
        <div className="px-4 py-4">
          {loadingRedemptions ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-600">กำลังโหลดประวัติ...</p>
            </div>
          ) : redemptions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center">
              <FaHistory className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">ยังไม่มีประวัติการแลกรางวัล</p>
            </div>
          ) : (
            <div className="space-y-4">
              {redemptions.map((redemption) => (
                <div key={redemption.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden">
                      {redemption.rewards?.image_url ? (
                        <Image
                          src={redemption.rewards.image_url}
                          alt={redemption.rewards.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <HiOutlineGift className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {redemption.rewards?.name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {new Date(redemption.created_at || '').toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        {getStatusBadge(redemption.status || 'requested')}
                      </div>
                      <div className="flex items-center text-sm text-gray-600 space-x-3">
                        <span className="flex items-center font-semibold text-red-600">
                          <HiOutlineGift className="mr-1 h-4 w-4" />
                          {redemption.points_used.toLocaleString()} แต้ม
                        </span>
                        <span className="text-xs">x{redemption.quantity || 1}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="rewards" />

      {/* Redeem Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ยืนยันการแลกรางวัล</DialogTitle>
            <DialogDescription>
              รางวัลจะพร้อมให้รับที่ร้าน กรุณามารับภายใน 7 วัน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedReward && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedReward.name}</h3>
                <div className="flex items-center text-red-600 font-bold text-xl">
                  <HiOutlineGift className="mr-2 h-5 w-5" />
                  {selectedReward.points_cost.toLocaleString()} แต้ม
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowRedeemDialog(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={submitting}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'กำลังดำเนินการ...' : 'ยืนยันการแลก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

