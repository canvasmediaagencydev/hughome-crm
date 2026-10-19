'use client'

/**
 * /admin/issues — รายการแจ้งปัญหาการใช้งาน (migration 028)
 *   ผู้ดูแลระบบ (issues.manage · super_admin = canvas): เห็นทุกรายการ เปลี่ยนสถานะ + เขียนบันทึกการแก้
 *   คนอื่น (issues.report): เห็นเฉพาะที่ตัวเองแจ้ง พร้อมสถานะและบันทึกจากผู้ดูแล
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bug, RefreshCw, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ReportIssueDialog } from '@/components/admin/ReportIssueDialog'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { PERMISSIONS } from '@/types/admin'
import { axiosAdmin } from '@/lib/axios-admin'
import {
  ISSUE_CATEGORY_LABEL,
  ISSUE_LIMITS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABEL,
  type IssueReport,
  type IssueStatus,
} from '@/lib/issue-reports'

const STATUS_STYLE: Record<IssueStatus, string> = {
  open: 'bg-red-100 text-red-800',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  wont_fix: 'bg-slate-200 text-slate-700',
}

function apiError(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { error?: string } } }
  return err.response?.data?.error ?? fallback
}

/** วันเวลาตามเวลาไทย ปี พ.ศ. */
function thaiDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function IssueCard({
  issue,
  canManage,
  onSaved,
}: {
  issue: IssueReport
  canManage: boolean
  onSaved: (i: IssueReport) => void
}) {
  const [status, setStatus] = useState<IssueStatus>(issue.status)
  const [note, setNote] = useState(issue.admin_note ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = status !== issue.status || note.trim() !== (issue.admin_note ?? '')

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await axiosAdmin.patch<IssueReport>(`/api/admin/issues/${issue.id}`, { status, admin_note: note })
      onSaved(data)
      toast.success('บันทึกแล้ว')
    } catch (e) {
      toast.error(apiError(e, 'บันทึกไม่สำเร็จ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[issue.status]}`}>
              {ISSUE_STATUS_LABEL[issue.status]}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {ISSUE_CATEGORY_LABEL[issue.category]}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-slate-900 break-words">{issue.title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            แจ้งโดย {issue.reporter_name} · {thaiDateTime(issue.created_at)}
            {issue.page_url && (
              <>
                {' · หน้า '}
                <a href={issue.page_url} className="font-mono text-blue-600 hover:underline">
                  {issue.page_url}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{issue.description}</p>

      {canManage ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`status-${issue.id}`} className="text-sm text-slate-600">
              สถานะ
            </label>
            <select
              id={`status-${issue.id}`}
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ISSUE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {issue.handler_name && issue.handled_at && (
              <span className="text-xs text-slate-400">
                อัปเดตล่าสุดโดย {issue.handler_name} · {thaiDateTime(issue.handled_at)}
              </span>
            )}
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={ISSUE_LIMITS.adminNote}
            rows={2}
            placeholder="บันทึกการแก้ไข (คนแจ้งจะเห็นข้อความนี้)"
            disabled={saving}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </Button>
          </div>
        </div>
      ) : (
        issue.admin_note && (
          <div className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
            <p className="mb-1 text-xs font-medium text-blue-700">
              ตอบกลับจากผู้ดูแลระบบ{issue.handled_at ? ` · ${thaiDateTime(issue.handled_at)}` : ''}
            </p>
            <p className="whitespace-pre-wrap break-words">{issue.admin_note}</p>
          </div>
        )
      )}
    </div>
  )
}

export default function IssuesPage() {
  const { hasPermission, isSuperAdmin } = useAdminAuth()
  const canReport = hasPermission(PERMISSIONS.ISSUES_REPORT) || isSuperAdmin
  const [issues, setIssues] = useState<IssueReport[] | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [filter, setFilter] = useState<IssueStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axiosAdmin.get<{ canManage: boolean; issues: IssueReport[] }>('/api/admin/issues')
      setIssues(data.issues)
      setCanManage(data.canManage)
    } catch (e) {
      toast.error(apiError(e, 'ดึงรายการไม่สำเร็จ'))
      setIssues([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canReport) load()
  }, [canReport, load])

  if (!canReport) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <Shield className="mb-3 h-12 w-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-900">ไม่มีสิทธิ์เข้าถึง</h2>
      </div>
    )
  }

  const counts = ISSUE_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: (issues ?? []).filter((i) => i.status === s).length }),
    {} as Record<IssueStatus, number>
  )
  const shown = (issues ?? []).filter((i) => filter === 'all' || i.status === filter)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Bug className="h-6 w-6" />
            {canManage ? 'แจ้งปัญหาการใช้งาน (ผู้ดูแลระบบ)' : 'ปัญหาที่ฉันแจ้ง'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {canManage
              ? 'ทุกเรื่องที่ทีมแจ้งเข้ามา · เปลี่ยนสถานะและเขียนบันทึกการแก้ให้คนแจ้งเห็น'
              : 'สถานะเรื่องที่คุณแจ้ง และข้อความตอบกลับจากผู้ดูแลระบบ'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> โหลดใหม่
          </Button>
          <ReportIssueDialog />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', ...ISSUE_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {s === 'all' ? `ทั้งหมด ${issues?.length ?? 0}` : `${ISSUE_STATUS_LABEL[s]} ${counts[s] ?? 0}`}
          </button>
        ))}
      </div>

      {issues === null ? (
        <p className="text-sm text-slate-400">กำลังโหลด…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          {issues.length === 0 ? 'ยังไม่มีการแจ้งปัญหา' : 'ไม่มีรายการในสถานะนี้'}
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((i) => (
            <IssueCard
              key={`${i.id}-${i.updated_at}`}
              issue={i}
              canManage={canManage}
              onSaved={(u) => setIssues((prev) => (prev ?? []).map((x) => (x.id === u.id ? u : x)))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
