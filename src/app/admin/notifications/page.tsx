'use client'

/**
 * /admin/notifications — ช่องแจ้งทีมร้าน (Telegram / LINE group) · Sprint 8
 *
 * แลกของสำเร็จ → ยิงเข้าทุก channel ที่เปิดอยู่ทันที · ปุ่ม "ทดสอบส่ง" ยิงข้อความจริงเข้ากลุ่ม
 * token ของ Telegram แสดงแค่ mask — กรอกใหม่ได้ อ่านค่าเดิมไม่ได้ (§9.5)
 */
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
import { Bell, Plus, Shield, Send, Trash2, KeyRound } from 'lucide-react'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { toast } from 'sonner'
import { axiosAdmin } from '@/lib/axios-admin'

interface Channel {
  id: string
  type: 'telegram' | 'line_group'
  target_id: string
  events: string[]
  is_active: boolean
  last_error: string | null
  last_sent_at: string | null
  created_at: string
  token_masked: string | null
}

const TYPE_LABEL: Record<Channel['type'], string> = {
  telegram: 'Telegram',
  line_group: 'LINE group',
}

function errorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

export default function NotificationsPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const canManage = hasPermission(PERMISSIONS.NOTIFICATIONS_MANAGE) || isSuperAdmin

  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [tokenTarget, setTokenTarget] = useState<Channel | null>(null)
  const [newToken, setNewToken] = useState('')
  const [form, setForm] = useState<{ type: Channel['type']; token: string; target_id: string }>({
    type: 'telegram',
    token: '',
    target_id: '',
  })

  const load = useCallback(async () => {
    try {
      const { data } = await axiosAdmin.get<Channel[]>('/api/admin/notifications')
      setChannels(data)
    } catch (e) {
      toast.error(errorMessage(e, 'ดึงรายการ channel ไม่สำเร็จ'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canManage) load()
    else setLoading(false)
  }, [canManage, load])

  const create = async () => {
    setSaving(true)
    try {
      const body: Record<string, unknown> = { type: form.type, target_id: form.target_id.trim() }
      if (form.type === 'telegram') body.token = form.token.trim()
      await axiosAdmin.post('/api/admin/notifications', body)
      toast.success(`เพิ่ม ${TYPE_LABEL[form.type]} แล้ว — กด "ทดสอบส่ง" เพื่อเช็คว่าถึงกลุ่ม`)
      setForm({ type: 'telegram', token: '', target_id: '' })
      setOpen(false)
      load()
    } catch (e) {
      toast.error(errorMessage(e, 'เพิ่ม channel ไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (ch: Channel) => {
    try {
      await axiosAdmin.patch(`/api/admin/notifications/${ch.id}`, { is_active: !ch.is_active })
      toast.success(ch.is_active ? 'ปิดการแจ้งเตือน channel นี้แล้ว' : 'เปิดการแจ้งเตือน channel นี้แล้ว')
      load()
    } catch (e) {
      toast.error(errorMessage(e, 'แก้ไขไม่สำเร็จ'))
    }
  }

  const test = async (ch: Channel) => {
    setTestingId(ch.id)
    try {
      await axiosAdmin.post(`/api/admin/notifications/${ch.id}/test`)
      toast.success(`ส่งข้อความทดสอบเข้า ${TYPE_LABEL[ch.type]} แล้ว — ไปดูในกลุ่ม`)
    } catch (e) {
      toast.error(errorMessage(e, 'ส่งทดสอบไม่สำเร็จ'))
    } finally {
      setTestingId(null)
      load()
    }
  }

  const remove = async (ch: Channel) => {
    if (!window.confirm(`ลบ ${TYPE_LABEL[ch.type]} (${ch.target_id})? การแจ้งเตือนเข้ากลุ่มนี้จะหยุดทันที`)) return
    try {
      await axiosAdmin.delete(`/api/admin/notifications/${ch.id}`)
      toast.success('ลบ channel แล้ว')
      load()
    } catch (e) {
      toast.error(errorMessage(e, 'ลบไม่สำเร็จ'))
    }
  }

  const saveToken = async () => {
    if (!tokenTarget) return
    setSaving(true)
    try {
      await axiosAdmin.patch(`/api/admin/notifications/${tokenTarget.id}`, { token: newToken.trim() })
      toast.success('บันทึก token ใหม่แล้ว')
      setTokenTarget(null)
      setNewToken('')
      load()
    } catch (e) {
      toast.error(errorMessage(e, 'บันทึก token ไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-slate-500">
          <Shield className="h-8 w-8" />
          <p>คุณไม่มีสิทธิ์ดูหน้านี้ (notifications.manage)</p>
        </CardContent>
      </Card>
    )
  }

  const activeCount = channels.filter((c) => c.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Bell className="h-6 w-6" /> แจ้งเตือนทีมร้าน
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            ลูกค้ากดแลกของ → ข้อความเด้งเข้ากลุ่ม Telegram / LINE ทันที (ชื่อ เบอร์ ของรางวัล แต้ม ลิงก์จัดการ)
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> เพิ่ม channel
        </Button>
      </div>

      {activeCount === 0 && !loading && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            ⚠️ ยังไม่มี channel ที่เปิดอยู่ — ทีมร้านจะไม่รู้ว่ามีคนกดแลกของ จนกว่าจะเปิดหน้า &quot;คำขอแลกรางวัล&quot; เอง
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            ทั้งหมด {channels.length} · เปิดอยู่ {activeCount}
          </CardTitle>
          <CardDescription>
            Telegram: สร้าง bot กับ @BotFather แล้วดึง bot เข้ากลุ่ม · chat id ของกลุ่มดูจาก @userinfobot หรือ getUpdates
            (มักขึ้นต้น -100) · LINE group: ดึง OA เข้ากลุ่ม แล้วเอา groupId จาก webhook event
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-slate-400">กำลังโหลด…</p>
          ) : channels.length === 0 ? (
            <p className="py-8 text-center text-slate-400">ยังไม่มี channel</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">ประเภท</th>
                    <th className="py-2 pr-4 font-medium">ปลายทาง</th>
                    <th className="py-2 pr-4 font-medium">token</th>
                    <th className="py-2 pr-4 font-medium">ส่งล่าสุด</th>
                    <th className="py-2 pr-4 font-medium">สถานะ</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((ch) => (
                    <tr key={ch.id} className="border-b last:border-0 align-top">
                      <td className="py-3 pr-4">
                        <Badge variant="outline">{TYPE_LABEL[ch.type]}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{ch.target_id}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                        {ch.type === 'telegram' ? (
                          <span className="inline-flex items-center gap-2">
                            {ch.token_masked ?? '—'}
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-900"
                              title="กรอก token ใหม่"
                              onClick={() => {
                                setTokenTarget(ch)
                                setNewToken('')
                              }}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="text-slate-400">ใช้ token ของ OA</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">
                        {fmt(ch.last_sent_at)}
                        {ch.last_error && (
                          <p className="mt-1 max-w-xs whitespace-pre-wrap break-words text-red-600">ล้มเหลว: {ch.last_error}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <Switch checked={ch.is_active} onCheckedChange={() => toggle(ch)} />
                          <span className="text-xs text-slate-500">{ch.is_active ? 'เปิด' : 'ปิด'}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => test(ch)} disabled={testingId === ch.id}>
                            <Send className="mr-1 h-3.5 w-3.5" />
                            {testingId === ch.id ? 'กำลังส่ง…' : 'ทดสอบส่ง'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(ch)} title="ลบ">
                            <Trash2 className="h-4 w-4 text-slate-400" />
                          </Button>
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

      {/* เพิ่ม channel */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่ม channel แจ้งเตือน</DialogTitle>
            <DialogDescription>ทุก channel ที่เปิดอยู่จะได้รับข้อความเมื่อมีคนกดแลกของ</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ประเภท</Label>
              <div className="mt-1 flex gap-2">
                {(['telegram', 'line_group'] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={form.type === t ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setForm({ ...form, type: t })}
                  >
                    {TYPE_LABEL[t]}
                  </Button>
                ))}
              </div>
            </div>
            {form.type === 'telegram' && (
              <div>
                <Label htmlFor="token">Bot token</Label>
                <Input
                  id="token"
                  type="password"
                  autoComplete="off"
                  placeholder="123456789:AAF…"
                  value={form.token}
                  onChange={(e) => setForm({ ...form, token: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500">เก็บแบบเข้ารหัส — หลังบันทึกจะเห็นแค่ 4 ตัวท้าย</p>
              </div>
            )}
            <div>
              <Label htmlFor="target">{form.type === 'telegram' ? 'Chat id ของกลุ่ม' : 'groupId ของ LINE'}</Label>
              <Input
                id="target"
                placeholder={form.type === 'telegram' ? '-1001234567890' : 'Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                value={form.target_id}
                onChange={(e) => setForm({ ...form, target_id: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button
              onClick={create}
              disabled={saving || !form.target_id.trim() || (form.type === 'telegram' && !form.token.trim())}
            >
              {saving ? 'กำลังบันทึก…' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* กรอก token ใหม่ */}
      <Dialog open={tokenTarget !== null} onOpenChange={(o) => !o && setTokenTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>กรอก Telegram bot token ใหม่</DialogTitle>
            <DialogDescription>
              {tokenTarget?.target_id} · token เดิม {tokenTarget?.token_masked ?? '—'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="newToken">Bot token</Label>
            <Input
              id="newToken"
              type="password"
              autoComplete="off"
              placeholder="123456789:AAF…"
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenTarget(null)}>
              ยกเลิก
            </Button>
            <Button onClick={saveToken} disabled={saving || !newToken.trim()}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
