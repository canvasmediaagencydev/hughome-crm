'use client'

/**
 * /admin/campaigns — ตัวคูณแต้มผูกช่วงวันที่ (Sprint 6)
 *
 * ตัวคูณตั้งได้จากหน้านี้เท่านั้น ไม่มีช่องให้พนักงานขายกรอกในไฟล์ Excel และไม่มี UI ฝั่งลูกค้า
 * แคมเปญที่เปิดใช้งานห้ามซ้อนช่วง — เช็คฝั่ง client ก่อนยิง แล้ว server/DB เช็คซ้ำอีกชั้น
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Percent, Plus, Shield, Pencil, Trash2 } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { Tables } from '../../../../database.types'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'
import {
  campaignPhase,
  findOverlapping,
  formatRange,
  overlapMessage,
  todayBangkok,
  type CampaignPhase,
} from '@/lib/campaigns'

type Campaign = Tables<'point_campaigns'>

interface FormState {
  name: string
  description: string
  multiplier: string
  starts_on: string
  ends_on: string
}

const EMPTY_FORM: FormState = { name: '', description: '', multiplier: '1.5', starts_on: '', ends_on: '' }

const PHASE_LABEL: Record<CampaignPhase, { text: string; variant: 'default' | 'secondary' | 'outline' }> = {
  running: { text: 'กำลังใช้งานวันนี้', variant: 'default' },
  upcoming: { text: 'ยังไม่เริ่ม', variant: 'outline' },
  ended: { text: 'สิ้นสุดแล้ว', variant: 'secondary' },
  inactive: { text: 'ปิดใช้งาน', variant: 'secondary' },
}

function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

export default function CampaignsPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const canManage = hasPermission(PERMISSIONS.CAMPAIGNS_MANAGE) || isSuperAdmin

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Campaign | null>(null)

  const today = useMemo(() => todayBangkok(), [])

  const load = useCallback(async () => {
    try {
      const { data } = await axiosAdmin.get<Campaign[]>('/api/admin/campaigns')
      setCampaigns(data)
    } catch {
      toast.error('ดึงรายการแคมเปญไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (c: Campaign) => {
    setEditing(c)
    setForm({
      name: c.name,
      description: c.description ?? '',
      multiplier: String(c.multiplier),
      starts_on: c.starts_on,
      ends_on: c.ends_on,
    })
    setDialogOpen(true)
  }

  // เช็คทับช่วงฝั่ง client ก่อนยิง (ตัวที่กำลังแก้ไม่นับตัวเอง · ตัวที่ปิดอยู่ไม่นับ)
  const clientConflict = useMemo(() => {
    if (!form.starts_on || !form.ends_on || form.ends_on < form.starts_on) return null
    if (editing && !editing.is_active) return null
    return findOverlapping(campaigns, form.starts_on, form.ends_on, editing?.id)
  }, [campaigns, form.starts_on, form.ends_on, editing])

  const rangeInvalid = Boolean(form.starts_on && form.ends_on && form.ends_on < form.starts_on)
  const multiplierNum = Number(form.multiplier)
  const multiplierInvalid = !Number.isFinite(multiplierNum) || multiplierNum <= 0
  const formReady =
    form.name.trim() !== '' &&
    form.starts_on !== '' &&
    form.ends_on !== '' &&
    !rangeInvalid &&
    !multiplierInvalid &&
    !clientConflict

  const save = async () => {
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      multiplier: multiplierNum,
      starts_on: form.starts_on,
      ends_on: form.ends_on,
    }
    try {
      if (editing) {
        await axiosAdmin.patch(`/api/admin/campaigns/${editing.id}`, payload)
        toast.success(`บันทึก "${payload.name}" แล้ว`)
      } else {
        await axiosAdmin.post('/api/admin/campaigns', payload)
        toast.success(`สร้างแคมเปญ "${payload.name}" แล้ว`)
      }
      setDialogOpen(false)
      load()
    } catch (e) {
      toast.error(apiError(e, editing ? 'แก้ไขแคมเปญไม่สำเร็จ' : 'สร้างแคมเปญไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (c: Campaign) => {
    // เปิดกลับมาอาจชนช่วงกับตัวที่สร้างทีหลัง — บอกก่อนยิง
    if (!c.is_active) {
      const conflict = findOverlapping(campaigns, c.starts_on, c.ends_on, c.id)
      if (conflict) {
        toast.error(overlapMessage(conflict))
        return
      }
    }
    try {
      await axiosAdmin.patch(`/api/admin/campaigns/${c.id}`, { is_active: !c.is_active })
      toast.success(c.is_active ? `ปิดใช้งาน "${c.name}"` : `เปิดใช้งาน "${c.name}"`)
      load()
    } catch (e) {
      toast.error(apiError(e, 'แก้ไขไม่สำเร็จ'))
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await axiosAdmin.delete(`/api/admin/campaigns/${deleting.id}`)
      toast.success(`ลบ "${deleting.name}" แล้ว`)
      setDeleting(null)
      load()
    } catch (e) {
      toast.error(apiError(e, 'ลบแคมเปญไม่สำเร็จ'))
      setDeleting(null)
    }
  }

  if (!hasPermission(PERMISSIONS.CAMPAIGNS_VIEW) && !isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Shield className="h-8 w-8" />
          <p>คุณไม่มีสิทธิ์ดูหน้านี้</p>
        </CardContent>
      </Card>
    )
  }

  const running = campaigns.find((c) => campaignPhase(c, today) === 'running')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Percent className="h-6 w-6" /> แคมเปญตัวคูณแต้ม
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            ตัวคูณผูกกับ &quot;วันที่ซื้อ&quot; ในไฟล์ยอดขาย — แต่ละวันมีตัวคูณได้ค่าเดียว
            แคมเปญที่เปิดใช้งานจึงห้ามซ้อนช่วงกัน · วันที่ไม่อยู่ในแคมเปญใด = ×1
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> สร้างแคมเปญ
          </Button>
        )}
      </div>

      {!loading && (
        <Card className={running ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}>
          <CardContent className="py-4 text-sm">
            {running ? (
              <span className="text-emerald-900">
                วันนี้ ({formatRangeSingle(today)}) ใช้ตัวคูณ <b>×{running.multiplier}</b> จาก &quot;{running.name}&quot;
              </span>
            ) : (
              <span className="text-slate-700">วันนี้ไม่มีแคมเปญ — ยอดซื้อวันนี้คิดตัวคูณ ×1</span>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ทั้งหมด {campaigns.length} แคมเปญ · เปิดใช้งาน {campaigns.filter((c) => c.is_active).length}
          </CardTitle>
          <CardDescription>
            ปิดใช้งานเมื่อไม่ต้องการแล้ว — แต้มที่ให้ไปแล้วไม่เปลี่ยน และช่วงวันจะว่างให้แคมเปญใหม่ใช้ได้
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>
          ) : campaigns.length === 0 ? (
            <p className="py-8 text-center text-slate-400">ยังไม่มีแคมเปญ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">ชื่อ</th>
                    <th className="py-2 pr-4 font-medium">ตัวคูณ</th>
                    <th className="py-2 pr-4 font-medium">ช่วงวันที่ซื้อ</th>
                    <th className="py-2 pr-4 font-medium">สถานะ</th>
                    {canManage && <th className="py-2 font-medium">จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const phase = campaignPhase(c, today)
                    const label = PHASE_LABEL[phase]
                    return (
                      <tr key={c.id} className={`border-b last:border-0 ${c.is_active ? '' : 'text-slate-400'}`}>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{c.name}</div>
                          {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                        </td>
                        <td className="py-2 pr-4 font-mono">×{c.multiplier}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{formatRange(c.starts_on, c.ends_on)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={label.variant}>{label.text}</Badge>
                        </td>
                        {canManage && (
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <Switch checked={c.is_active} onCheckedChange={() => toggle(c)} />
                              <Button variant="ghost" size="sm" onClick={() => openEdit(c)} aria-label="แก้ไข">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleting(c)}
                                aria-label="ลบ"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขแคมเปญ' : 'สร้างแคมเปญ'}</DialogTitle>
            <DialogDescription>
              ตัวคูณจะถูกใช้กับทุกแถวในไฟล์ยอดขายที่ &quot;วันที่ซื้อ&quot; อยู่ในช่วงนี้
              {editing && ' · แก้แล้ว batch ที่ preview ค้างไว้ต้องอัปโหลดใหม่'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">ชื่อแคมเปญ</Label>
              <Input
                id="name"
                placeholder="ฮักโฮมปลายฝน รับแต้ม 1.5 เท่า"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="multiplier">ตัวคูณ</Label>
              <Input
                id="multiplier"
                type="number"
                step="0.01"
                min="0.01"
                max="99.99"
                value={form.multiplier}
                onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">เช่น 1.5 หรือ 2 · ทศนิยมไม่เกิน 2 ตำแหน่ง</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="starts_on">วันเริ่ม</Label>
                <Input
                  id="starts_on"
                  type="date"
                  value={form.starts_on}
                  onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ends_on">วันสิ้นสุด</Label>
                <Input
                  id="ends_on"
                  type="date"
                  value={form.ends_on}
                  min={form.starts_on || undefined}
                  onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
                />
              </div>
            </div>
            {rangeInvalid && <p className="text-sm text-red-600">วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น</p>}
            {clientConflict && <p className="text-sm text-red-600">{overlapMessage(clientConflict)}</p>}
            <div>
              <Label htmlFor="description">คำอธิบาย (ไม่บังคับ)</Label>
              <Textarea
                id="description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={save} disabled={saving || !formReady}>
              {saving ? 'กำลังบันทึก…' : editing ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ลบแคมเปญ &quot;{deleting?.name}&quot;?</DialogTitle>
            <DialogDescription>
              ลบได้เฉพาะแคมเปญที่ยังไม่เคยให้แต้ม — ถ้ามีแต้มอ้างถึงอยู่ระบบจะปฏิเสธ ให้ใช้ &quot;ปิดใช้งาน&quot; แทน
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              ยกเลิก
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              ลบถาวร
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatRangeSingle(iso: string): string {
  return formatRange(iso, iso).split(' – ')[0]
}
