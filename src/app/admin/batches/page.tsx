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
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Shield,
  AlertTriangle,
  Send,
  Eye,
  FileDown,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'

type RowStatus = 'valid' | 'duplicate_amount' | 'invalid' | 'unmatched'
type BatchStatus = 'draft' | 'previewed' | 'pending_approval' | 'committed' | 'voided'

interface PreviewRow {
  row_no: number
  customer_code: string | null
  purchase_date: string | null
  bill_no: string | null
  phone: string | null
  customer_name: string | null
  gross: number | null
  discount: number
  net: number | null
  sales_rep_code: string | null
  sales_rep_name: string | null
  campaign_name: string | null
  multiplier: number
  points: number | null
  status: RowStatus
  errors: string[]
  warnings: string[]
  duplicate_of_row: number | null
}

interface Summary {
  total: number
  valid: number
  duplicate_amount: number
  invalid: number
  unmatched: number
  warned: number
  total_points: number
}

/** preview ที่เปิดอยู่ — มาจาก /upload (สดใหม่) หรือ GET /:id (เปิดจากประวัติ) */
interface OpenPreview {
  batch_id: string
  file_name: string
  status: BatchStatus
  week_start: string
  week_end: string
  submitted_by_name?: string | null
  summary: Summary
  rows: PreviewRow[]
}

interface BatchRow {
  id: string
  file_name: string
  week_start: string
  week_end: string
  status: BatchStatus
  total_rows: number
  valid_rows: number
  invalid_rows: number
  unmatched_rows: number
  total_points: number
  created_at: string
  submitted_at: string | null
  committed_at: string | null
  voided_at: string | null
  void_reason: string | null
  uploaded_by_name: string | null
  submitted_by_name: string | null
  committed_by_name: string | null
  reviewed_by_name: string | null
  voided_by_name: string | null
}

const STATUS_LABEL: Record<BatchStatus, { text: string; cls: string }> = {
  draft: { text: 'ร่าง', cls: 'bg-slate-200 text-slate-700' },
  previewed: { text: 'รอส่ง', cls: 'bg-slate-100 text-slate-700' },
  pending_approval: { text: 'รอผู้อนุมัติ', cls: 'bg-amber-100 text-amber-800' },
  committed: { text: 'แต้มเข้าแล้ว', cls: 'bg-green-100 text-green-800' },
  voided: { text: 'ยกเลิก', cls: 'bg-red-100 text-red-800' },
}

const FILTERS: { key: BatchStatus | 'all'; text: string }[] = [
  { key: 'all', text: 'ทั้งหมด' },
  { key: 'previewed', text: 'รอส่ง' },
  { key: 'pending_approval', text: 'รอผู้อนุมัติ' },
  { key: 'committed', text: 'แต้มเข้าแล้ว' },
  { key: 'voided', text: 'ยกเลิก' },
]

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

async function downloadBlob(url: string, filename: string, fallbackError: string) {
  try {
    const res = await axiosAdmin.get(url, { responseType: 'blob' })
    const cd = String(res.headers?.['content-disposition'] ?? '')
    const m = cd.match(/filename="([^"]+)"/)
    const objectUrl = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = m?.[1] ?? filename
    a.click()
    URL.revokeObjectURL(objectUrl)
  } catch (e: unknown) {
    // blob error → ต้องอ่านข้อความจริงออกมาจาก Blob ก่อน
    const err = e as { response?: { data?: Blob } }
    if (err.response?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await err.response.data.text())
        toast.error(parsed.error ?? fallbackError)
        return
      } catch {
        /* ตกไปใช้ข้อความรวม */
      }
    }
    toast.error(apiError(e, fallbackError))
  }
}

export default function BatchesPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const can = (p: string) => hasPermission(p) || isSuperAdmin
  const canUpload = can(PERMISSIONS.BATCHES_UPLOAD)
  const canApprove = can(PERMISSIONS.BATCHES_APPROVE)
  const canVoid = can(PERMISSIONS.BATCHES_VOID)

  const [batches, setBatches] = useState<BatchRow[]>([])
  const [filter, setFilter] = useState<BatchStatus | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [week, setWeek] = useState(lastWeekRange())
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<OpenPreview | null>(null)
  const [busy, setBusy] = useState(false)
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

  const downloadTemplate = () =>
    downloadBlob(
      '/api/admin/batches/template',
      `Hughome_Sales_Template_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'ดาวน์โหลด template ไม่สำเร็จ'
    )

  const downloadBatchReport = (b: { id: string; week_start: string; week_end: string }) =>
    downloadBlob(`/api/admin/reports/batches/${b.id}/excel`, `batch_${b.week_start}_${b.week_end}.xlsx`, 'ดาวน์โหลดรายงานไม่สำเร็จ')

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('week_start', week.start)
      fd.append('week_end', week.end)
      const { data } = await axiosAdmin.post<OpenPreview & { batch_id: string }>('/api/admin/batches/upload', fd)
      setPreview({ ...data, status: 'previewed', week_start: week.start, week_end: week.end })
      const awardable = data.summary.valid + data.summary.duplicate_amount
      toast.success(`อ่านไฟล์สำเร็จ — ได้แต้ม ${awardable} จาก ${data.summary.total} แถว`)
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'อัปโหลดไม่สำเร็จ'))
    } finally {
      setUploading(false)
    }
  }

  /** เปิด preview ของชุดจากประวัติ (ผู้อนุมัติต้องเห็นแถวก่อนกดอนุมัติ · บัญชีเปิดชุด previewed หลัง reload ได้) */
  const openBatch = async (b: BatchRow) => {
    try {
      const { data } = await axiosAdmin.get<Omit<OpenPreview, 'batch_id'> & { id: string }>(`/api/admin/batches/${b.id}`)
      setPreview({ ...data, batch_id: data.id })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e: unknown) {
      toast.error(apiError(e, 'เปิดชุดไม่สำเร็จ'))
    }
  }

  const submit = async () => {
    if (!preview) return
    setBusy(true)
    try {
      await axiosAdmin.post(`/api/admin/batches/${preview.batch_id}/submit`)
      toast.success('ส่งให้ผู้อนุมัติแล้ว — แต้มจะเข้าเมื่อผู้อนุมัติกดอนุมัติ')
      setPreview({ ...preview, status: 'pending_approval' })
      setFile(null)
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'ส่งให้ผู้อนุมัติไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  const approve = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const { data } = await axiosAdmin.post(`/api/admin/batches/${preview.batch_id}/commit`)
      toast.success(
        `อนุมัติแล้ว — แต้มเข้า ${data.total_points.toLocaleString()} แต้ม · ลูกค้า ${data.customers_awarded} คน · ส่ง LINE ${data.line_notified} คน`
      )
      setPreview(null)
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'อนุมัติไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  const openVoid = (b: BatchRow) => {
    setVoidReason('')
    setVoidTarget(b)
  }

  const doVoid = async () => {
    if (!voidTarget) return
    setBusy(true)
    try {
      await axiosAdmin.post(`/api/admin/batches/${voidTarget.id}/void`, { reason: voidReason })
      toast.success(
        voidTarget.status === 'pending_approval' ? 'ปฏิเสธชุดแล้ว — ไม่มีแต้มเข้าใคร' : 'ยกเลิกทั้งชุดแล้ว — ดึงแต้มคืนจากลูกค้าทุกคนในชุด'
      )
      if (preview?.batch_id === voidTarget.id) setPreview(null)
      setVoidTarget(null)
      setVoidReason('')
      load()
    } catch (e: unknown) {
      toast.error(apiError(e, 'ยกเลิกไม่สำเร็จ'))
    } finally {
      setBusy(false)
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

  const visible = filter === 'all' ? batches : batches.filter((b) => b.status === filter)
  const countOf = (k: BatchStatus | 'all') => (k === 'all' ? batches.length : batches.filter((b) => b.status === k).length)
  const awardable = preview ? preview.summary.valid + preview.summary.duplicate_amount : 0
  const previewBatchRow = preview ? batches.find((b) => b.id === preview.batch_id) : undefined

  const rowClass = (r: PreviewRow) => {
    if (r.status === 'invalid') return 'bg-red-50'
    if (r.status === 'unmatched') return 'bg-amber-50'
    if (r.status === 'duplicate_amount' || r.warnings.length > 0) return 'bg-yellow-50'
    return ''
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <FileSpreadsheet className="h-6 w-6" /> อัปโหลดยอดขาย
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            รับไฟล์จาก Maker → เลือกช่วงสัปดาห์ → ตรวจ preview → ส่งให้ผู้อนุมัติ → ผู้อนุมัติกดอนุมัติ แต้มจึงเข้า
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด template
        </Button>
      </div>

      {/* ---------------- upload ---------------- */}
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">อัปโหลดไฟล์ใหม่</CardTitle>
            <CardDescription>
              วันที่ซื้อทุกแถวในไฟล์ต้องอยู่ในช่วงสัปดาห์ที่เลือก ไม่งั้นแถวนั้นจะถูกตีตก · ยังไม่มีแต้มเข้าใครจนกว่าผู้อนุมัติจะกดอนุมัติ
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

      {/* ---------------- preview / review ---------------- */}
      {preview && (
        <Card className={preview.status === 'pending_approval' ? 'border-amber-400' : 'border-slate-300'}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {preview.status === 'pending_approval' ? 'ตรวจก่อนอนุมัติ' : preview.status === 'previewed' ? 'ตรวจก่อนส่งให้ผู้อนุมัติ' : 'รายละเอียดชุด'}
                  <span className="font-normal text-slate-500">— {preview.file_name}</span>
                  <Badge className={STATUS_LABEL[preview.status].cls}>{STATUS_LABEL[preview.status].text}</Badge>
                </CardTitle>
                <CardDescription>
                  สัปดาห์ {preview.week_start} → {preview.week_end}
                  {preview.status === 'previewed' && ' · ยังไม่มีแต้มเข้าใครจนกว่าผู้อนุมัติจะกดอนุมัติ'}
                  {preview.status === 'pending_approval' &&
                    ` · ส่งโดย ${preview.submitted_by_name ?? previewBatchRow?.submitted_by_name ?? '—'} · กดอนุมัติแล้วแต้มเข้าทันที`}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                ปิด
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="rounded bg-slate-100 px-3 py-1">ทั้งหมด {preview.summary.total}</span>
              <span className="rounded bg-green-100 px-3 py-1 text-green-800">ใช้ได้ {preview.summary.valid}</span>
              {preview.summary.duplicate_amount > 0 && (
                <span className="rounded bg-yellow-200 px-3 py-1 font-semibold text-yellow-900">
                  ⚠ ยอดซ้ำ {preview.summary.duplicate_amount} แถว (ยังได้แต้ม — ผู้อนุมัติต้องตรวจ)
                </span>
              )}
              {preview.summary.warned - preview.summary.duplicate_amount > 0 && (
                <span className="rounded bg-yellow-100 px-3 py-1 text-yellow-900">
                  เตือนอื่น {preview.summary.warned - preview.summary.duplicate_amount} แถว
                </span>
              )}
              <span className="rounded bg-red-100 px-3 py-1 text-red-800">ผิดพลาด {preview.summary.invalid}</span>
              <span className="rounded bg-amber-100 px-3 py-1 text-amber-800">ไม่พบลูกค้า {preview.summary.unmatched}</span>
              <span className="rounded bg-blue-100 px-3 py-1 font-semibold text-blue-800">
                รวม {preview.summary.total_points.toLocaleString()} แต้ม
              </span>
            </div>

            <div className="max-h-[26rem] overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-2 py-2">แถว</th>
                    <th className="px-2 py-2">รหัสลูกค้า</th>
                    <th className="px-2 py-2">วันที่ซื้อ</th>
                    <th className="px-2 py-2">เลขที่บิล</th>
                    <th className="px-2 py-2">เบอร์</th>
                    <th className="px-2 py-2">ลูกค้า</th>
                    <th className="px-2 py-2 text-right">สุทธิ</th>
                    <th className="px-2 py-2">Maker</th>
                    <th className="px-2 py-2">แคมเปญ</th>
                    <th className="px-2 py-2 text-right">แต้ม</th>
                    <th className="px-2 py-2">ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.row_no} className={'border-t ' + rowClass(r)}>
                      <td className="px-2 py-1.5">{r.row_no}</td>
                      <td className="px-2 py-1.5 font-mono">{r.customer_code ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.purchase_date ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono">{r.bill_no ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.phone ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.customer_name ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right">{r.net?.toLocaleString() ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.sales_rep_name ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.campaign_name ? `${r.campaign_name} (x${r.multiplier})` : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{r.points ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        {r.errors.length > 0 ? (
                          <span className="text-red-700">{r.errors.join(' · ')}</span>
                        ) : r.status === 'duplicate_amount' ? (
                          <span className="font-medium text-yellow-800">⚠ {r.warnings.join(' · ')}</span>
                        ) : r.warnings.length > 0 ? (
                          <span className="text-yellow-800">ใช้ได้ · ⚠ {r.warnings.join(' · ')}</span>
                        ) : (
                          <span className="text-green-700">ใช้ได้</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---- ปุ่มตามสถานะ + สิทธิ์ ---- */}
            <div className="flex flex-wrap items-center gap-2">
              {awardable === 0 && preview.status === 'previewed' && (
                <p className="flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4" /> ไม่มีแถวที่ใช้ได้เลย — แก้ไฟล์แล้วอัปโหลดใหม่
                </p>
              )}
              {preview.status === 'previewed' && awardable > 0 && canUpload && (
                <Button onClick={submit} disabled={busy}>
                  <Send className="mr-1 h-4 w-4" />
                  {busy ? 'กำลังส่ง…' : `ส่งให้ผู้อนุมัติ — ${awardable} แถว · ${preview.summary.total_points.toLocaleString()} แต้ม`}
                </Button>
              )}
              {preview.status === 'previewed' && !canUpload && (
                <p className="text-sm text-slate-500">ชุดนี้ยังไม่ได้ส่งให้ผู้อนุมัติ — รอบัญชีกด "ส่งให้ผู้อนุมัติ"</p>
              )}
              {preview.status === 'pending_approval' && canApprove && (
                <Button onClick={approve} disabled={busy} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  {busy ? 'กำลังให้แต้ม…' : `อนุมัติ (แต้มเข้า) — ${preview.summary.total_points.toLocaleString()} แต้ม`}
                </Button>
              )}
              {preview.status === 'pending_approval' && canVoid && previewBatchRow && (
                <Button variant="outline" onClick={() => openVoid(previewBatchRow)} disabled={busy}>
                  <XCircle className="mr-1 h-4 w-4" /> ปฏิเสธ
                </Button>
              )}
              {preview.status === 'pending_approval' && !canApprove && (
                <p className="text-sm text-amber-700">รอผู้อนุมัติ — คุณไม่มีสิทธิ์อนุมัติชุดนี้</p>
              )}
              {preview.status !== 'previewed' && (
                <Button variant="outline" onClick={() => downloadBatchReport({ id: preview.batch_id, week_start: preview.week_start, week_end: preview.week_end })}>
                  <FileDown className="mr-1 h-4 w-4" /> รายงานชุดนี้ (Excel)
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------- history ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ประวัติการอัปโหลด</CardTitle>
          <CardDescription>ทุกชุดบันทึกว่าใครอัปโหลด ใครส่ง ใครอนุมัติ และใครยกเลิก</CardDescription>
          <div className="mt-2 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'outline'}
                onClick={() => setFilter(f.key)}
              >
                {f.text} <span className="ml-1 text-xs opacity-70">{countOf(f.key)}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-slate-400">{batches.length === 0 ? 'ยังไม่มีการอัปโหลด' : 'ไม่มีชุดในสถานะนี้'}</p>
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
                    <th className="py-2 pr-4 font-medium">อัปโหลด</th>
                    <th className="py-2 pr-4 font-medium">ส่งโดย</th>
                    <th className="py-2 pr-4 font-medium">อนุมัติโดย</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b) => (
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
                        {b.status === 'voided' && (
                          <div className="mt-1 text-xs text-slate-500">
                            โดย {b.voided_by_name ?? '—'}
                            {b.void_reason && ` · ${b.void_reason}`}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-4">{b.uploaded_by_name ?? '—'}</td>
                      <td className="py-2 pr-4">{b.submitted_by_name ?? '—'}</td>
                      <td className="py-2 pr-4">{b.committed_by_name ?? '—'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {(b.status === 'previewed' || b.status === 'pending_approval') && (
                            <Button size="sm" variant="outline" onClick={() => openBatch(b)}>
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              {b.status === 'pending_approval' && canApprove ? 'ตรวจ/อนุมัติ' : 'เปิด preview'}
                            </Button>
                          )}
                          {b.status === 'previewed' && canUpload && (
                            <Button
                              size="sm"
                              onClick={async () => {
                                await openBatch(b)
                              }}
                            >
                              <Send className="mr-1 h-3.5 w-3.5" /> ส่งให้ผู้อนุมัติ
                            </Button>
                          )}
                          {b.status === 'pending_approval' && canVoid && (
                            <Button size="sm" variant="outline" onClick={() => openVoid(b)}>
                              <XCircle className="mr-1 h-3.5 w-3.5" /> ปฏิเสธ
                            </Button>
                          )}
                          {b.status === 'committed' && canVoid && (
                            <Button size="sm" variant="outline" onClick={() => openVoid(b)}>
                              <XCircle className="mr-1 h-3.5 w-3.5" /> ยกเลิกทั้งชุด (Rollback)
                            </Button>
                          )}
                          {b.status !== 'previewed' && b.status !== 'draft' && (
                            <Button size="sm" variant="ghost" onClick={() => downloadBatchReport(b)} title="รายงานชุดนี้ (Excel)">
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
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
            <DialogTitle>
              {voidTarget?.status === 'pending_approval' ? 'ปฏิเสธชุดนี้ (ยังไม่มีแต้มเข้า)' : 'ยกเลิกทั้งชุด (Rollback) และดึงแต้มคืน'}
            </DialogTitle>
            <DialogDescription>
              {voidTarget?.status === 'pending_approval'
                ? 'ชุดนี้ยังไม่ได้ให้แต้มใคร — ปฏิเสธแล้วบัญชีต้องแก้ไฟล์และอัปโหลดใหม่ · เลขที่บิลในชุดกลับมาใช้ได้'
                : 'แต้มของลูกค้า "ทุกคน" ในชุดนี้จะถูกดึงคืนทั้งหมด (ทุกบิล ไม่ใช่แค่แถวที่ผิด) · เลขที่บิลจะกลับมาคีย์ใหม่ได้ · ถ้าลูกค้าใช้แต้มบางส่วนไปแล้ว ระบบดึงคืนเฉพาะที่เหลือ'}
              {voidTarget && ` · ${voidTarget.file_name} (${voidTarget.total_points.toLocaleString()} แต้ม)`}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="reason">เหตุผล (บันทึกไว้ในประวัติ)</Label>
            <Input
              id="reason"
              placeholder="เช่น Maker คีย์ยอดผิดทั้งไฟล์"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              ไม่ทำ
            </Button>
            <Button variant="destructive" onClick={doVoid} disabled={busy || voidReason.trim().length < 3}>
              {voidTarget?.status === 'pending_approval' ? 'ยืนยันปฏิเสธ' : 'ยืนยันยกเลิกทั้งชุดและดึงแต้มคืน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
