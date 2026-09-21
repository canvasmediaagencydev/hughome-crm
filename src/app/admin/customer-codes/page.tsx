'use client'

/**
 * /admin/customer-codes — นำเข้ารหัสลูกค้าจากระบบเดิม (Q1 · 2026-09-21)
 * ไฟล์ .xlsx 2 คอลัมน์ (A รหัส · B เบอร์) → preview (dry-run) → ยืนยันเขียนจริง
 */
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IdCard, Upload, CheckCircle2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { axiosAdmin } from '@/lib/axios-admin'
import { CUSTOMER_CODE_FORMAT_HINT } from '@/lib/customer-code'

type RowStatus = 'will_set' | 'already_same' | 'conflict' | 'unmatched' | 'invalid' | 'duplicate_in_file'
interface Row {
  row_no: number
  code: string | null
  phone_raw: string | null
  phone: string | null
  user_name: string | null
  current_code: string | null
  status: RowStatus
  message: string
}
interface Result {
  applied: boolean
  file_name: string
  summary: Record<'total' | RowStatus | 'applied', number>
  rows: Row[]
}

const STATUS: Record<RowStatus, { text: string; cls: string }> = {
  will_set: { text: 'จะตั้งรหัส', cls: 'text-green-700' },
  already_same: { text: 'ตรงอยู่แล้ว', cls: 'text-slate-500' },
  conflict: { text: 'ขัดแย้ง', cls: 'text-red-700' },
  unmatched: { text: 'ไม่พบลูกค้า', cls: 'text-amber-700' },
  invalid: { text: 'ผิดพลาด', cls: 'text-red-700' },
  duplicate_in_file: { text: 'ซ้ำในไฟล์', cls: 'text-red-700' },
}

const apiError = (e: unknown, fb: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? fb

export default function CustomerCodesPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const canEdit = hasPermission(PERMISSIONS.USERS_EDIT) || isSuperAdmin
  const [file, setFile] = useState<File | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const run = async (apply: boolean) => {
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (apply) fd.append('apply', '1')
      if (overwrite) fd.append('overwrite', '1')
      const { data } = await axiosAdmin.post<Result>('/api/admin/users/import-codes', fd)
      setResult(data)
      toast.success(apply ? `บันทึกรหัสให้ลูกค้า ${data.summary.applied} คนแล้ว` : `ตรวจไฟล์แล้ว — จะตั้งรหัส ${data.summary.will_set} คน`)
    } catch (e) {
      toast.error(apiError(e, 'นำเข้าไม่สำเร็จ'))
    } finally {
      setBusy(false)
    }
  }

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Shield className="h-8 w-8" />
          <p>คุณไม่มีสิทธิ์แก้ไขข้อมูลลูกค้า</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <IdCard className="h-6 w-6" /> นำเข้ารหัสลูกค้า
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          รหัสจากระบบเดิมของร้าน จับคู่กับลูกค้าที่สมัครผ่าน LINE ด้วย "เบอร์โทร" · ไม่สร้างลูกค้าใหม่ ไม่แตะแต้ม
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ไฟล์ .xlsx</CardTitle>
          <CardDescription>
            แผ่นแรก · แถว 1 หัวตาราง · คอลัมน์ A = รหัสลูกค้า ({CUSTOMER_CODE_FORMAT_HINT}) · คอลัมน์ B = เบอร์โทร 10 หลัก ·
            ตรวจก่อนเสมอ (dry-run) แล้วค่อยกดบันทึก
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="f">ไฟล์</Label>
              <Input id="f" type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null) }} />
            </div>
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              ทับรหัสเดิมที่ต่างกัน (ปกติข้ามและรายงานเป็น "ขัดแย้ง")
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => run(false)} disabled={!file || busy}>
              <Upload className="mr-1 h-4 w-4" /> ตรวจไฟล์ (ยังไม่บันทึก)
            </Button>
            <Button
              onClick={() => run(true)}
              disabled={!file || busy || !result || result.applied || result.summary.will_set === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {result && !result.applied ? `บันทึกรหัสให้ ${result.summary.will_set} คน` : 'บันทึก'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.applied ? 'border-green-300' : 'border-slate-300'}>
          <CardHeader>
            <CardTitle className="text-base">
              {result.applied ? `บันทึกแล้ว — ${result.file_name}` : `ผลตรวจ — ${result.file_name}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded bg-slate-100 px-3 py-1">ทั้งหมด {result.summary.total}</span>
              <span className="rounded bg-green-100 px-3 py-1 text-green-800">
                {result.applied ? `บันทึกแล้ว ${result.summary.applied}` : `จะตั้งรหัส ${result.summary.will_set}`}
              </span>
              <span className="rounded bg-slate-100 px-3 py-1 text-slate-600">ตรงอยู่แล้ว {result.summary.already_same}</span>
              <span className="rounded bg-amber-100 px-3 py-1 text-amber-800">ไม่พบลูกค้า {result.summary.unmatched}</span>
              <span className="rounded bg-red-100 px-3 py-1 text-red-800">
                ขัดแย้ง {result.summary.conflict} · ผิดพลาด {result.summary.invalid} · ซ้ำในไฟล์ {result.summary.duplicate_in_file}
              </span>
            </div>
            <div className="max-h-[28rem] overflow-auto rounded border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-2 py-2">แถว</th>
                    <th className="px-2 py-2">รหัส</th>
                    <th className="px-2 py-2">เบอร์</th>
                    <th className="px-2 py-2">ลูกค้าในระบบ</th>
                    <th className="px-2 py-2">รหัสเดิม</th>
                    <th className="px-2 py-2">ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.row_no} className={'border-t ' + (r.status === 'will_set' || r.status === 'already_same' ? '' : r.status === 'unmatched' ? 'bg-amber-50' : 'bg-red-50')}>
                      <td className="px-2 py-1.5">{r.row_no}</td>
                      <td className="px-2 py-1.5 font-mono">{r.code ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.phone ?? r.phone_raw ?? '—'}</td>
                      <td className="px-2 py-1.5">{r.user_name ?? '—'}</td>
                      <td className="px-2 py-1.5 font-mono">{r.current_code ?? '—'}</td>
                      <td className={'px-2 py-1.5 ' + STATUS[r.status].cls}>
                        {STATUS[r.status].text} · {r.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
