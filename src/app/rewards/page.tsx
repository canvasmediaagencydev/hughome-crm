'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
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
import { useRouter, useSearchParams } from 'next/navigation'
import { FaHistory } from 'react-icons/fa'
import { HiOutlineGift, HiOutlineSparkles } from 'react-icons/hi'
import { HiOutlineShoppingBag } from 'react-icons/hi2'
import BottomNavigation from '@/components/BottomNavigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'

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

function RewardsContent() {
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
  const searchParams = useSearchParams()

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'history') {
      setActiveTab('history')
    }
  }, [searchParams])

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

        const cachedSession = UserSessionManager.getCachedSession()
        if (cachedSession) {
          UserSessionManager.updateUserData({
            ...cachedSession.user,
            points_balance: data.newBalance,
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

  if (loading) {
    return <LoadingSpinner message="กำลังโหลดรางวัล..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Hero Header with Points */}
      <div className="relative bg-gradient-to-br from-red-600 via-red-500 to-orange-500 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-12 -right-10 w-44 h-44 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute top-16 -left-12 w-36 h-36 bg-yellow-300/15 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-1/3 w-28 h-28 bg-orange-300/15 rounded-full blur-xl" />
        </div>

        <div className="relative px-5 pt-7 pb-10">
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineSparkles className="w-4 h-4 text-amber-200" />
            <span className="text-white/85 text-xs font-medium tracking-wide uppercase">
              Hug Point Rewards
            </span>
          </div>
          <h1 className="text-white text-2xl font-bold leading-snug">
            แลกของรางวัลสุดพิเศษ
          </h1>
          <p className="text-white/80 text-sm mt-1">
            สะสมแต้ม แลกของรางวัลที่คุณชอบ
          </p>
        </div>

        {/* Wave bottom */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg
            viewBox="0 0 1200 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-6"
            aria-hidden="true"
          >
            <path
              d="M0 20C150 35 350 35 600 20C850 5 1050 5 1200 20V40H0V20Z"
              fill="#F9FAFB"
            />
          </svg>
        </div>
      </div>

      {/* Points Card - Floating overlap */}
      <div className="px-4 -mt-6 relative z-10">
        <div className="relative bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 rounded-2xl p-5 shadow-xl border border-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-amber-500/15" />
          <div className="absolute -top-8 -right-6 w-28 h-28 bg-amber-500/20 rounded-full blur-2xl" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-widest">
                  Active Balance
                </span>
              </div>
              <p className="text-gray-400 text-xs mb-1">แต้มคงเหลือของคุณ</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white font-bold text-3xl tabular-nums bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  {userPoints.toLocaleString()}
                </span>
                <span className="text-amber-400 font-semibold text-sm">แต้ม</span>
              </div>
            </div>
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400/30 to-amber-600/20 rounded-2xl flex items-center justify-center border border-amber-300/20">
              <HiOutlineGift className="w-7 h-7 text-amber-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="px-4 pt-5">
        <div
          role="tablist"
          aria-label="rewards tabs"
          className="bg-white rounded-2xl p-1 shadow-sm border border-gray-100 grid grid-cols-2 gap-1"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'rewards'}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
              activeTab === 'rewards'
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md shadow-red-500/25'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('rewards')}
          >
            <HiOutlineShoppingBag className="h-4 w-4" />
            ของรางวัล
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'history'}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-md shadow-red-500/25'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveTab('history')}
          >
            <FaHistory className="h-3.5 w-3.5" />
            ประวัติ
          </button>
        </div>
      </div>

      {/* Available Rewards */}
      {activeTab === 'rewards' && (
        <div className="px-4 py-5">
          {loadingRewards ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                >
                  <div className="aspect-square bg-gray-200 animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                    <div className="h-7 bg-gray-200 rounded-lg animate-pulse mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : rewards.length === 0 ? (
            <EmptyState
              icon={<HiOutlineGift className="h-10 w-10 text-gray-400" />}
              title="ยังไม่มีรางวัลที่พร้อมแลก"
              description="กลับมาดูใหม่เร็วๆ นี้"
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-gray-900 font-bold text-base">
                  รางวัลที่แลกได้
                </h2>
                <span className="text-gray-500 text-xs">
                  {rewards.length} รายการ
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {rewards.map((reward) => {
                  const canAfford = userPoints >= reward.points_cost
                  const stock = reward.remaining_stock
                  const isOutOfStock = stock === 0
                  const isLowStock =
                    stock !== null && stock !== undefined && stock > 0 && stock < 10

                  return (
                    <div
                      key={reward.id}
                      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col"
                    >
                      {/* Image */}
                      <div className="relative aspect-square bg-gray-100 overflow-hidden">
                        {reward.image_url ? (
                          <Image
                            src={reward.image_url}
                            alt={reward.name}
                            fill
                            sizes="(max-width: 768px) 50vw, 25vw"
                            className="object-cover group-active:scale-95 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                            <HiOutlineGift className="h-10 w-10 text-gray-300" />
                          </div>
                        )}

                        {/* Stock badge */}
                        {(isOutOfStock || isLowStock) && (
                          <div className="absolute top-2 left-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm ${
                                isOutOfStock
                                  ? 'bg-gray-700/90'
                                  : 'bg-orange-500/95'
                              }`}
                            >
                              {isOutOfStock
                                ? 'หมดสต็อก'
                                : `เหลือ ${stock} ชิ้น`}
                            </span>
                          </div>
                        )}

                        {/* Affordability indicator */}
                        {canAfford && !isOutOfStock && (
                          <div className="absolute top-2 right-2">
                            <span className="flex items-center gap-1 bg-emerald-500/95 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                              <HiOutlineSparkles className="h-2.5 w-2.5" />
                              แลกได้
                            </span>
                          </div>
                        )}

                        {/* Points overlay at bottom of image */}
                        <div className="absolute bottom-2 left-2 right-2">
                          <div className="bg-white/95 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center justify-center gap-1 shadow-sm">
                            <HiOutlineGift className="h-3.5 w-3.5 text-red-600" />
                            <span className="font-bold text-red-600 text-sm tabular-nums">
                              {reward.points_cost.toLocaleString()}
                            </span>
                            <span className="text-red-600/80 text-[10px] font-medium">
                              แต้ม
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3 flex-1 flex flex-col">
                        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 mb-1">
                          {reward.name}
                        </h3>
                        {reward.description && (
                          <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                            {reward.description}
                          </p>
                        )}

                        <Button
                          size="sm"
                          className={`w-full mt-auto h-9 text-xs font-semibold rounded-xl transition-all active:scale-[0.97] ${
                            canAfford && !isOutOfStock
                              ? 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white shadow-sm shadow-red-500/20'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-100'
                          }`}
                          onClick={() => handleOpenRedeemDialog(reward)}
                          disabled={!canAfford || isOutOfStock}
                        >
                          {isOutOfStock
                            ? 'หมดสต็อก'
                            : canAfford
                            ? 'แลกเลย'
                            : `ขาดอีก ${(
                                reward.points_cost - userPoints
                              ).toLocaleString()} แต้ม`}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Redemption History */}
      {activeTab === 'history' && (
        <div className="px-4 py-5">
          {loadingRedemptions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3"
                >
                  <div className="w-20 h-20 bg-gray-200 rounded-xl animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : redemptions.length === 0 ? (
            <EmptyState
              icon={<FaHistory className="h-10 w-10 text-gray-400" />}
              title="ยังไม่มีประวัติการแลกรางวัล"
              description="เริ่มแลกของรางวัลของคุณวันนี้"
            />
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-gray-900 font-bold text-base">
                  ประวัติการแลก
                </h2>
                <span className="text-gray-500 text-xs">
                  {redemptions.length} รายการ
                </span>
              </div>
              <div className="space-y-3">
                {redemptions.map((redemption) => (
                  <div
                    key={redemption.id}
                    className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-3">
                      <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 relative overflow-hidden">
                        {redemption.rewards?.image_url ? (
                          <Image
                            src={redemption.rewards.image_url}
                            alt={redemption.rewards.name}
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                            <HiOutlineGift className="h-8 w-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 flex-1">
                            {redemption.rewards?.name || 'ไม่พบข้อมูลรางวัล'}
                          </h3>
                          <StatusBadge
                            status={redemption.status || 'requested'}
                            type="redemption"
                          />
                        </div>
                        <p className="text-[11px] text-gray-400 mb-2">
                          {new Date(
                            redemption.created_at || ''
                          ).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-lg">
                            <HiOutlineGift className="h-3.5 w-3.5" />
                            <span className="font-bold text-xs tabular-nums">
                              {redemption.points_used.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-medium">แต้ม</span>
                          </div>
                          {redemption.quantity && redemption.quantity > 1 && (
                            <span className="text-xs text-gray-500 font-medium">
                              x{redemption.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <BottomNavigation currentPage="rewards" />

      {/* Redeem Confirmation Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <HiOutlineGift className="h-4 w-4 text-white" />
              </div>
              ยืนยันการแลกรางวัล
            </DialogTitle>
            <DialogDescription>
              รางวัลจะพร้อมให้รับที่ร้าน กรุณามารับภายใน 7 วัน
            </DialogDescription>
          </DialogHeader>
          {selectedReward && (
            <div className="space-y-3">
              <div className="flex gap-3 bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-xl border border-gray-200">
                <div className="w-16 h-16 bg-white rounded-lg flex-shrink-0 relative overflow-hidden">
                  {selectedReward.image_url ? (
                    <Image
                      src={selectedReward.image_url}
                      alt={selectedReward.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HiOutlineGift className="h-7 w-7 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-1">
                    {selectedReward.name}
                  </h3>
                  <div className="inline-flex items-center gap-1 text-red-600 font-bold">
                    <HiOutlineGift className="h-4 w-4" />
                    <span className="tabular-nums">
                      {selectedReward.points_cost.toLocaleString()}
                    </span>
                    <span className="text-xs font-medium">แต้ม</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">แต้มคงเหลือก่อนแลก</span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    {userPoints.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-600">หักแต้ม</span>
                  <span className="font-semibold text-red-600 tabular-nums">
                    -{selectedReward.points_cost.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-amber-200 my-2" />
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 font-medium">
                    คงเหลือหลังแลก
                  </span>
                  <span className="font-bold text-emerald-600 tabular-nums">
                    {(userPoints - selectedReward.points_cost).toLocaleString()}{' '}
                    แต้ม
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRedeemDialog(false)}
              disabled={submitting}
              className="w-full sm:flex-1 rounded-xl"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={submitting}
              className="w-full sm:flex-1 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 rounded-xl shadow-md shadow-red-500/25"
            >
              {submitting ? 'กำลังดำเนินการ...' : 'ยืนยันการแลก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function RewardsPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="กำลังโหลดรางวัล..." />}>
      <RewardsContent />
    </Suspense>
  )
}
