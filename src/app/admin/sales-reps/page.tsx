'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserSquare2, Plus, Shield } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { Tables } from '../../../../database.types'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'

type SalesRep = Tables<'sales_reps'>

export default function SalesRepsPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const canManage = hasPermission(PERMISSIONS.SALESREPS_MANAGE) || isSuperAdmin

  const [reps, setReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ code: '', full_name: '', phone: '' })

  const load = useCallback(async () => {
    try {
      const { data } = await axiosAdmin.get<SalesRep[]>('/api/admin/sales-reps')
      setReps(data)
    } catch {
      toast.error('ดึงรายชื่อ Maker ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    setSaving(true)
    try {
      await axiosAdmin.post('/api/admin/sales-reps', form)
      toast.success(`เพิ่ม "${form.code} · ${form.full_name}" แล้ว`)
      setForm({ code: '', full_name: '', phone: '' })
      setOpen(false)
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error ?? 'เพิ่ม Maker ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (rep: SalesRep) => {
    try {
      await axiosAdmin.patch(`/api/admin/sales-reps/${rep.id}`, { is_active: !rep.is_active })
      toast.success(rep.is_active ? `ปิดใช้งาน ${rep.full_name}` : `เปิดใช้งาน ${rep.full_name}`)
      load()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error ?? 'แก้ไขไม่สำเร็จ')
    }
  }

  if (!hasPermission(PERMISSIONS.SALESREPS_VIEW) && !isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Shield className="h-8 w-8" />
          <p>คุณไม่มีสิทธิ์ดูหน้านี้</p>
        </CardContent>
      </Card>
    )
  }

  const activeCount = reps.filter((r) => r.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <UserSquare2 className="h-6 w-6" /> Maker (พนักงานผู้คีย์ยอดขาย)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            รายชื่อที่นี่คือตัวเลือกใน dropdown ของไฟล์ Excel · ลาออกให้ปิดใช้งาน ไม่มีปุ่มลบ
            เพราะยอดเก่าต้องสาวกลับได้
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> เพิ่ม Maker
          </Button>
        )}
      </div>

      {activeCount === 0 && !loading && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            ⚠️ ยังไม่มี Maker ที่เปิดใช้งาน — ดาวน์โหลด template ไม่ได้ และทุกแถวในไฟล์ที่อัปโหลดจะถูกตีเป็น
            &quot;ไม่พบ Maker&quot;
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ทั้งหมด {reps.length} คน · เปิดใช้งาน {activeCount} คน
          </CardTitle>
          <CardDescription>รหัสพนักงานใช้จับคู่กับไฟล์ Excel — เปลี่ยนไม่ได้หลังสร้าง</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>
          ) : reps.length === 0 ? (
            <p className="py-8 text-center text-slate-400">ยังไม่มี Maker</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">รหัส</th>
                    <th className="py-2 pr-4 font-medium">ชื่อ-สกุล</th>
                    <th className="py-2 pr-4 font-medium">เบอร์โทร</th>
                    <th className="py-2 pr-4 font-medium">สถานะ</th>
                    {canManage && <th className="py-2 font-medium">เปิด/ปิด</th>}
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono">{r.code}</td>
                      <td className="py-2 pr-4">{r.full_name}</td>
                      <td className="py-2 pr-4 text-slate-500">{r.phone ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={r.is_active ? 'default' : 'secondary'}>
                          {r.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="py-2">
                          <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่ม Maker</DialogTitle>
            <DialogDescription>
              ชื่อจะไปโผล่ใน dropdown ของ template รอบถัดไปที่ดาวน์โหลด
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">รหัสพนักงาน</Label>
              <Input
                id="code"
                placeholder="S01"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">A-Z a-z 0-9 _ - เท่านั้น ยาวไม่เกิน 16 ตัว ห้ามเว้นวรรค</p>
            </div>
            <div>
              <Label htmlFor="full_name">ชื่อ-สกุล</Label>
              <Input
                id="full_name"
                placeholder="สมชาย ใจดี"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">เบอร์โทร (ไม่บังคับ)</Label>
              <Input
                id="phone"
                placeholder="0812345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={create} disabled={saving || !form.code.trim() || !form.full_name.trim()}>
              {saving ? 'กำลังบันทึก…' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
