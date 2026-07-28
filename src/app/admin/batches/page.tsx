'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileSpreadsheet, Upload, Download, CheckCircle2, XCircle, Shield, AlertTriangle } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'

interface PreviewRow {
  row_no: number
  purchase_date: string | null
  bill_no: string | null
  phone: string | null
  customer_name: string | null
  gross: number | null
  discount: number
  net: number | null
  sales_rep_name: string | null
  campaign_name: string | null
  multiplier: number
  points: number | null
  status: 'valid' | 'invalid' | 'unmatched'
  errors: string[]
}

interface PreviewResponse {
  batch_id: string
  file_name: string
  summary: {
    total: number
    valid: number
    invalid: number
    unmatched: number
    blank_skipped: number
    total_points: number
  }
  rows: PreviewRow[]
}

interface BatchRow {
  id: string
  file_name: string
  week_start: string
  week_end: string
  status: 'draft' | 'previewed' | 'committed' | 'voided'
  total_rows: number
  valid_rows: number
  invalid_rows: number
  unmatched_rows: number
  total_points: number
  created_at: string
  committed_at: string | null
  voided_at: string | null
  void_reason: string | null
  uploaded_by_name: string | null
  committed_by_name: string | null
  reviewed_by_name: string | null
  voided_by_name: string | null
}

const STATUS_LABEL: Record<BatchRow['status'], { text: string; cls: string }> = {
  draft: { text: 'ร่าง', cls: 'bg-slate-200 text-slate-700' },
  previewed: { text: 'รอยืนยัน', cls: 'bg-amber-100 text-amber-800' },
  committed: { text: 'แต้มเข้าแล้ว', cls: 'bg-green-100 text-green-800' },
  voided: { text: 'ยกเลิกแล้ว', cls: 'bg-red-100 text-red-800' },
}

const apiError = (e: unknown, fallback: string) => {
  const err = e as { response?: { data?: { error?: string; details?: string[] } } }
  const d = err.response?.data
  return [d?.error ?? fallback, ...(d?.details ?? [])].join('\n')
}

/** วันจันทร์ของสัปดาห์ที่แล้ว → ค่าเริ่มต้นที่บัญชีใช้บ่อยสุด (ส่งไฟล์ของสัปดาห์ที่ผ่านมา) */
function lastWeekRange() {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 - 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const f = (d: Date) => d.toISOString().slice(0, 10)
  return { start: f(monday), end: f(sunday) }
}

export default function BatchesPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const can = (p: string) => hasPermission(p) || isSuperAdmin

  const [batches, setBatches] = useState<BatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState(lastWeekRange())
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [committing, setCommitting] = useState(false)
  const [voidTarget, setVoidTarget] = useState<BatchRow | null>(null)
  const [voidReason, setVoidReason] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await axiosAdmin.get<BatchRow[]>('/api/admin/batches')
      setBatches(data)
    } catch {
      toast.error('ดึงรายการ batch ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const downloadTemplate = async () => {
    try {
      const res = await axiosAdmin.get('/api/admin/batches/template', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Hughome_Sales_Template_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      // blob error → ต้องอ่านข้อความจริงออกมาจาก Blob ก่อน
      const err = e as { response?: { data?: Blob } }
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text())
          toast.error(parsed.error ?? 'ดาวน์โหลด template ไม่สำเร็จ')
          return
        } catch {
          /* ตกไปใช้ข้อความรวม */
        }
      }
      toast.error(apiError(e, 'ดาวน์โหลด template ไม่สำเร็จ'))
    }
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('week_start', week.start)
      fd.append('week_end', week.end)
      const { data } = await axiosAdmin.post<PreviewResponse>('/api/admin/batches/upload', fd)
      setPreview(data)
      toast.success(`อ่านไฟล์สำเร็จ — ใช้ได้ ${data.summary.valid} จาก ${data.summary.total} แถว`)
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'อัปโหลดไม่สำเร็จ'))
    } finally {
      setUploading(false)
    }
  }

  const commit = async () => {
    if (!preview) return
    setCommitting(true)
    try {
      const { data } = await axiosAdmin.post(`/api/admin/batches/${preview.batch_id}/commit`)
      toast.success(
        `แต้มเข้าแล้ว ${data.total_points.toLocaleString()} แต้ม · ลูกค้า ${data.customers_awarded} คน · แจ้ง LINE ${data.line_notified} คน`
      )
      setPreview(null)
      setFile(null)
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'ให้แต้มไม่สำเร็จ'))
    } finally {
      setCommitting(false)
    }
  }

  const doVoid = async () => {
    if (!voidTarget) return
    try {
      await axiosAdmin.post(`/api/admin/batches/${voidTarget.id}/void`, { reason: voidReason })
      toast.success('ยกเลิก batch และคืนแต้มแล้ว')
      setVoidTarget(null)
      setVoidReason('')
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'ยกเลิกไม่สำเร็จ'))
    }
  }

  if (!can(PERMISSIONS.BATCHES_VIEW)) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Shield className="h-8 w-8" />
          <p>คุณไม่มีสิทธิ์ดูหน้านี้</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileSpreadsheet className="h-6 w-6" /> อัปโหลดยอดขาย
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            รับไฟล์จากพนักงานขาย → เลือกช่วงสัปดาห์ → ตรวจ preview → กดยืนยันให้แต้มเข้า
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด template
        </Button>
      </div>

      {/* ---------------- upload ---------------- */}
      {can(PERMISSIONS.BATCHES_UPLOAD) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">อัปโหลดไฟล์ใหม่</CardTitle>
            <CardDescription>
              วันที่ซื้อทุกแถวในไฟล์ต้องอยู่ในช่วงสัปดาห์ที่เลือก ไม่งั้นแถวนั้นจะถูกตีตก
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="ws">สัปดาห์เริ่ม</Label>
                <Input id="ws" type="date" value={week.start} onChange={(e) => setWeek({ ...week, start: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="we">สัปดาห์จบ</Label>
                <Input id="we" type="date" value={week.end} onChange={(e) => setWeek({ ...week, end: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="f">ไฟล์ .xlsx</Label>
                <Input id="f" type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <Button onClick={upload} disabled={!file || uploading}>
              <Upload className="mr-1 h-4 w-4" />
              {uploading ? 'กำลังอ่านไฟล์…' : 'อัปโหลดและตรวจ'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ---------------- preview ---------------- */}
      {preview && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base">ตรวจก่อนยืนยัน — {preview.file_name}</CardTitle>
            <CardDescription>ยังไม่มีแต้มเข้าใครจนกว่าจะกดปุ่มยืนยันด้านล่าง</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded bg-slate-100 px-3 py-1">ทั้งหมด {preview.summary.total}</span>
              <span className="rounded bg-green-100 px-3 py-1 text-green-800">ใช้ได้ {preview.summary.valid}</span>
              <span className="rounded bg-red-100 px-3 py-1 text-red-800">ผิดพลาด {preview.summary.invalid}</span>
              <span className="rounded bg-amber-100 px-3 py-1 text-amber-800">
                ไม่พบลูกค้า {preview.summary.unmatched}
              </span>
              <span className="rounded bg-blue-100 px-3 py-1 font-semibold text-blue-800">
                รวม {preview.summary.total_points.toLocaleString()} แต้ม
              </span>
            </div>

            <div className="max-h-[26rem] overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-2 py-2">แถว</th>
                    <th className="px-2 py-2">วันที่ซื้อ</th>
                    <th className="px-2 py-2">เลขที่บิล</th>
                    <th className="px-2 py-2">เบอร์</th>
                    <th className="px-2 py-2">ลูกค้า</th>
                    <th className="px-2 py-2 text-right">สุทธิ</th>
                    <th className="px-2 py-2">พนักงานขาย</th>
                    <th className="px-2 py-2">แคมเปญ</th>
                    <th className="px-2 py-2 text-right">แต้ม</th>
                    <th className="px-2 py-2">ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr
                      key={r.row_no}
                      className={
                        'border-t ' +
                        (r.status === 'valid' ? '' : r.status === 'unmatched' ? 'bg-amber-50' : 'bg-red-50')
                      }
                    >
                      <td className="px-2 py-1.5">{r.row_no}</td>
                      <td className="px-2 py-1.5">{r.purchase_date ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono">{r.bill_no ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.phone ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.customer_name ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{r.net?.toLocaleString() ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.sales_rep_name ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        {r.campaign_name ? `${r.campaign_name} (x${r.multiplier})` : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold">{r.points ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        {r.status === 'valid' ? (
                          <span className="text-green-700">ใช้ได้</span>
                        ) : (
                          <span className="text-red-700">{r.errors.join(' · ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.summary.valid === 0 ? (
              <p className="flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" /> ไม่มีแถวที่ใช้ได้เลย — แก้ไฟล์แล้วอัปโหลดใหม่
              </p>
            ) : (
              can(PERMISSIONS.BATCHES_COMMIT) && (
                <Button onClick={commit} disabled={committing} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  {committing
                    ? 'กำลังให้แต้ม…'
                    : `ยืนยัน — ให้แต้ม ${preview.summary.total_points.toLocaleString()} แต้ม`}
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------- history ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการอัปโหลด</CardTitle>
          <CardDescription>ทุก batch บันทึกว่าใครอัปโหลดและใครกดให้แต้มเข้า</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>
          ) : batches.length === 0 ? (
            <p className="py-8 text-center text-slate-400">ยังไม่มีการอัปโหลด</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">ไฟล์</th>
                    <th className="py-2 pr-4 font-medium">สัปดาห์</th>
                    <th className="py-2 pr-4 font-medium">แถว</th>
                    <th className="py-2 pr-4 font-medium">แต้ม</th>
                    <th className="py-2 pr-4 font-medium">สถานะ</th>
                    <th className="py-2 pr-4 font-medium">อัปโหลดโดย</th>
                    <th className="py-2 pr-4 font-medium">แต้มเข้าโดย</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{b.file_name}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {b.week_start} → {b.week_end}
                      </td>
                      <td className="py-2 pr-4">
                        {b.valid_rows}/{b.total_rows}
                      </td>
                      <td className="py-2 pr-4">{b.total_points.toLocaleString()}</td>
                      <td className="py-2 pr-4">
                        <Badge className={STATUS_LABEL[b.status].cls}>{STATUS_LABEL[b.status].text}</Badge>
                      </td>
                      <td className="py-2 pr-4">{b.uploaded_by_name ?? '—'}</td>
                      <td className="py-2 pr-4">{b.committed_by_name ?? '—'}</td>
                      <td className="py-2">
                        {b.status === 'committed' && can(PERMISSIONS.BATCHES_VOID) && (
                          <Button size="sm" variant="outline" onClick={() => setVoidTarget(b)}>
                            <XCircle className="mr-1 h-3.5 w-3.5" /> ยกเลิก
                          </Button>
                        )}
                        {b.status === 'voided' && b.void_reason && (
                          <span className="text-xs text-slate-500">{b.void_reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยกเลิก batch และคืนแต้ม</DialogTitle>
            <DialogDescription>
              แต้มที่ให้ไปจะถูกดึงคืนจากลูกค้าทุกคนใน batch นี้ · เลขที่บิลจะกลับมาคีย์ใหม่ได้
              {voidTarget && ` · ${voidTarget.file_name} (${voidTarget.total_points.toLocaleString()} แต้ม)`}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reason">เหตุผล</Label>
            <Input
              id="reason"
              placeholder="เช่น พนักงานคีย์ยอดผิดทั้งไฟล์"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              ไม่ยกเลิก
            </Button>
            <Button variant="destructive" onClick={doVoid} disabled={voidReason.trim().length < 3}>
              ยืนยันยกเลิกและคืนแต้ม
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
