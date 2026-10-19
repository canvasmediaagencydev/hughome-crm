'use client'

/**
 * ปุ่ม + dialog "แจ้งปัญหาการใช้งาน" — อยู่ใน sidebar ของทุกหน้าหลังบ้าน (migration 028)
 * แนบหน้าที่กดแจ้ง (path + query) ให้อัตโนมัติ · ส่งแล้วเข้ากล่องผู้ดูแลระบบที่ /admin/issues
 */
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Bug, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { axiosAdmin } from '@/lib/axios-admin'
import { ISSUE_CATEGORIES, ISSUE_CATEGORY_LABEL, ISSUE_LIMITS, type IssueCategory } from '@/lib/issue-reports'

function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

export function ReportIssueDialog({ className }: { className?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<IssueCategory>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)

  const reset = () => {
    setCategory('bug')
    setTitle('')
    setDescription('')
  }

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('กรอกหัวข้อและรายละเอียดก่อนส่ง')
      return
    }
    setSending(true)
    try {
      const page = `${pathname}${typeof window === 'undefined' ? '' : window.location.search}`
      await axiosAdmin.post('/api/admin/issues', { category, title, description, page_url: page })
      toast.success('ส่งเรื่องให้ผู้ดูแลระบบแล้ว — ติดตามสถานะได้ที่เมนู "แจ้งปัญหา"')
      reset()
      setOpen(false)
    } catch (e) {
      toast.error(apiError(e, 'ส่งเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={className}
      >
        <Bug className="mr-2 h-4 w-4" />
        <span className="text-sm">แจ้งปัญหาการใช้งาน</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>แจ้งปัญหาการใช้งาน</DialogTitle>
            <DialogDescription>
              ส่งถึงผู้ดูแลระบบโดยตรง · ระบบแนบหน้าที่คุณอยู่ตอนนี้ (<span className="font-mono">{pathname}</span>) ให้อัตโนมัติ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="issue-category">ประเภท</Label>
              <select
                id="issue-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as IssueCategory)}
                disabled={sending}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ISSUE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-title">หัวข้อ</Label>
              <Input
                id="issue-title"
                value={title}
                maxLength={ISSUE_LIMITS.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น กดอนุมัติแล้วขึ้น error"
                disabled={sending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-description">รายละเอียด</Label>
              <Textarea
                id="issue-description"
                value={description}
                maxLength={ISSUE_LIMITS.description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                placeholder={'ทำอะไรอยู่ · กดปุ่มไหน · เห็นข้อความอะไร (คัดลอกข้อความ error มาได้เลย)'}
                disabled={sending}
              />
              <p className="text-right text-xs text-slate-400">
                {description.length.toLocaleString()} / {ISSUE_LIMITS.description.toLocaleString()}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Link href="/admin/issues" className="text-sm text-blue-600 hover:underline self-center" onClick={() => setOpen(false)}>
              ดูรายการที่เคยแจ้ง
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>
                ยกเลิก
              </Button>
              <Button onClick={submit} disabled={sending}>
                <Send className="mr-1 h-4 w-4" />
                {sending ? 'กำลังส่ง…' : 'ส่งเรื่อง'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
