'use client'

/**
 * กระดิ่งขวาบน + จำนวนงานที่รอให้ role นี้กด (ประชุมลูกค้า 2026-10-21)
 * ข้อมูลจาก GET /api/admin/inbox · โหลดใหม่ทุก 60 วินาที และเมื่อกลับมาที่แท็บ
 * useAdminInbox ใช้ร่วมกับ layout เพื่อแสดงจุดแดงที่เมนูแต่ละหน้า (react-query cache เดียวกัน ยิงครั้งเดียว)
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { axiosAdmin } from '@/lib/axios-admin'

export interface InboxItem {
  key: string
  title: string
  count: number
  href: string
}

interface InboxResponse {
  items: InboxItem[]
  total: number
}

export function useAdminInbox(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['admin-inbox'],
    queryFn: async () => (await axiosAdmin.get<InboxResponse>('/api/admin/inbox')).data,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000,
    retry: 1,
  })
}

/** จำนวนงานต่อเมนู — จับด้วย path ของ href (ตัด query ออก) */
export function inboxCountByPath(items: InboxItem[] | undefined): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items ?? []) {
    const path = it.href.split('?')[0]
    m.set(path, (m.get(path) ?? 0) + it.count)
  }
  return m
}

export function AdminInboxBell({ className = '' }: { className?: string }) {
  const { data } = useAdminInbox()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const total = data?.total ?? 0

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `การแจ้งเตือน ${total} รายการ` : 'การแจ้งเตือน'}
        aria-expanded={open}
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-white">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900">งานที่รอคุณดำเนินการ</div>
          {!data ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">กำลังโหลด…</p>
          ) : data.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">ไม่มีงานค้าง</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((it) => (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-red-600" />
                      {it.title}
                    </span>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{it.count.toLocaleString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
