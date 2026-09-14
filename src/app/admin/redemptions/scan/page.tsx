'use client'

/**
 * /admin/redemptions/scan?code=XXXXXXXX — ส่งมอบของจาก QR ของลูกค้า (Sprint 8)
 *
 * QR ในมือถือลูกค้า encode เป็น URL หน้านี้ → พนักงานสแกนด้วยกล้องมือถือ (ไม่ต้องมีไลบรารีสแกน)
 * หรือพิมพ์รหัส 8 ตัวเองก็ได้ · หน้านี้เรียก GET /lookup แล้วให้กดยืนยัน → PATCH :id/status delivered
 * ส่งมอบได้เฉพาะสถานะ "พร้อมรับของ" — ถ้ายังไม่ถึงให้เดินหน้าจากหน้ารายการก่อน
 */
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QrCode as QrIcon, Shield, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { StatusBadge } from '@/components/StatusBadge'
import { axiosAdmin } from '@/lib/axios-admin'
import { toast } from 'sonner'
import { formatDate, formatPoints, getUserDisplayName } from '@/lib/utils'
import { NEXT_STATUS, REDEMPTION_STATUS_LABEL, normalizePickupCode, type RedemptionStatus } from '@/lib/redemption-status'

interface LookupRedemption {
  id: string
  status: RedemptionStatus
  pickup_code: string | null
  points_used: number
  quantity: number
  created_at: string
  delivered_at: string | null
  rewards: { id: string; name: string; image_url: string | null; points_cost: number } | null
  user_profiles: { id: string; display_name: string | null; first_name: string | null; last_name: string | null; phone: string | null } | null
}

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

function ScanContent() {
  const { hasPermission, isSuperAdmin, loading: authLoading } = useAdminAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code') ?? ''

  const [input, setInput] = useState(codeFromUrl)
  const [looking, setLooking] = useState(false)
  const [delivering, setDelivering] = useState(false)
  const [found, setFound] = useState<LookupRedemption | null>(null)
  const [done, setDone] = useState(false)

  const canDeliver = hasPermission(PERMISSIONS.REDEMPTIONS_DELIVER) || isSuperAdmin
  const canProcess = hasPermission(PERMISSIONS.REDEMPTIONS_PROCESS) || isSuperAdmin

  const lookup = useCallback(async (raw: string) => {
    const code = normalizePickupCode(raw)
    if (!code) {
      toast.error('รหัสรับของต้องเป็นตัวอักษร/ตัวเลข 8 ตัว')
      return
    }
    setLooking(true)
    setFound(null)
    setDone(false)
    try {
      const { data } = await axiosAdmin.get('/api/admin/redemptions/lookup', { params: { code } })
      setFound(data.redemption)
    } catch (e) {
      toast.error(errorMessage(e, 'ค้นหาใบแลกไม่สำเร็จ'))
    } finally {
      setLooking(false)
    }
  }, [])

  // เปิดจาก QR → ค้นหาให้ทันที
  useEffect(() => {
    if (!authLoading && codeFromUrl) lookup(codeFromUrl)
  }, [authLoading, codeFromUrl, lookup])

  const advance = async (target: RedemptionStatus) => {
    if (!found) return
    setDelivering(true)
    try {
      const { data } = await axiosAdmin.patch(`/api/admin/redemptions/${found.id}/status`, { status: target })
      setFound(data.redemption)
      if (target === 'delivered') {
        setDone(true)
        toast.success('ส่งมอบของเรียบร้อย')
      } else {
        toast.success(`เปลี่ยนเป็น "${REDEMPTION_STATUS_LABEL[target]}" แล้ว`)
      }
    } catch (e) {
      toast.error(errorMessage(e, 'เปลี่ยนสถานะไม่สำเร็จ'))
      lookup(found.pickup_code ?? input)
    } finally {
      setDelivering(false)
    }
  }

  if (authLoading) {
    return <p className="py-12 text-center text-slate-400">กำลังตรวจสอบสิทธิ์…</p>
  }
  if (!hasPermission(PERMISSIONS.REDEMPTIONS_VIEW) && !isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Shield className="h-8 w-8" />
          <p>คุณไม่มีสิทธิ์ดูหน้านี้</p>
        </CardContent>
      </Card>
    )
  }

  const next = found ? NEXT_STATUS[found.status] : undefined

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/admin/redemptions" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> กลับไปหน้ารายการ
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900">
          <QrIcon className="h-6 w-6" /> สแกน QR รับของ
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ใช้กล้องมือถือสแกน QR ของลูกค้า (จะเปิดหน้านี้พร้อมรหัส) หรือพิมพ์รหัส 8 ตัวที่ลูกค้าแสดง
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              const code = normalizePickupCode(input)
              if (code) router.replace(`/admin/redemptions/scan?code=${code}`)
              lookup(input)
            }}
          >
            <div className="flex-1">
              <Label htmlFor="code">รหัสรับของ</Label>
              <Input
                id="code"
                value={input}
                onChange={(e) => setInput(e.target.value.toUpperCase())}
                placeholder="เช่น 7K3M9X2Q"
                autoComplete="off"
                autoFocus={!codeFromUrl}
                className="font-mono text-lg tracking-widest"
                maxLength={12}
              />
            </div>
            <Button type="submit" disabled={looking || !input.trim()}>
              {looking ? 'กำลังค้นหา…' : 'ค้นหา'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {found && (
        <Card className={done ? 'border-green-300 bg-green-50' : undefined}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{found.rewards?.name ?? 'ของรางวัล'}</CardTitle>
                <CardDescription>
                  {formatPoints(found.points_used)} · ×{found.quantity} · แลกเมื่อ {formatDate(found.created_at, { includeTime: true })}
                </CardDescription>
              </div>
              <StatusBadge status={found.status} type="redemption" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium text-slate-900">{found.user_profiles ? getUserDisplayName(found.user_profiles) : '-'}</p>
              <p className="text-slate-500">{found.user_profiles?.phone ?? '-'}</p>
              <p className="mt-1 font-mono text-xs text-slate-500">รหัส {found.pickup_code}</p>
            </div>

            {done || found.status === 'delivered' ? (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  รับของแล้ว{found.delivered_at ? ` เมื่อ ${formatDate(found.delivered_at, { includeTime: true })}` : ''}
                </span>
              </div>
            ) : found.status === 'cancelled' ? (
              <p className="text-sm text-red-600">ใบแลกนี้ถูกยกเลิกแล้ว — ห้ามส่งมอบของ</p>
            ) : found.status === 'ready' ? (
              canDeliver ? (
                <Button className="w-full" size="lg" onClick={() => advance('delivered')} disabled={delivering}>
                  {delivering ? 'กำลังบันทึก…' : 'ยืนยันส่งมอบของ'}
                </Button>
              ) : (
                <p className="text-sm text-amber-700">คุณไม่มีสิทธิ์ส่งมอบของ (redemptions.deliver)</p>
              )
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-amber-700">
                  สถานะยัง &quot;{REDEMPTION_STATUS_LABEL[found.status]}&quot; — ต้องเป็น &quot;พร้อมรับของ&quot; ก่อนจึงส่งมอบได้
                </p>
                {next && canProcess && (
                  <Button variant="outline" className="w-full" onClick={() => advance(next)} disabled={delivering}>
                    {delivering ? 'กำลังบันทึก…' : `เปลี่ยนเป็น "${REDEMPTION_STATUS_LABEL[next]}"`}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={<p className="py-12 text-center text-slate-400">กำลังโหลด…</p>}>
      <ScanContent />
    </Suspense>
  )
}
