/**
 * รายการแจ้งปัญหาการใช้งานจากหลังบ้าน (migration 028)
 * ค่าที่นี่ต้องตรงกับ CHECK ใน 028_issue_reports.sql · client- และ server-safe
 */
export const ISSUE_CATEGORIES = ['bug', 'question', 'request', 'other'] as const
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]

export const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'wont_fix'] as const
export type IssueStatus = (typeof ISSUE_STATUSES)[number]

export const ISSUE_CATEGORY_LABEL: Record<IssueCategory, string> = {
  bug: 'ระบบทำงานผิด / error',
  question: 'สอบถามวิธีใช้',
  request: 'ขอเพิ่ม/ปรับฟีเจอร์',
  other: 'อื่น ๆ',
}

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: 'รอตรวจสอบ',
  in_progress: 'กำลังแก้ไข',
  resolved: 'แก้แล้ว',
  wont_fix: 'ไม่แก้ / ไม่ใช่ปัญหา',
}

export const ISSUE_LIMITS = {
  title: 120,
  description: 4000,
  pageUrl: 500,
  userAgent: 500,
  adminNote: 4000,
} as const

export const isIssueCategory = (v: unknown): v is IssueCategory =>
  typeof v === 'string' && (ISSUE_CATEGORIES as readonly string[]).includes(v)

export const isIssueStatus = (v: unknown): v is IssueStatus =>
  typeof v === 'string' && (ISSUE_STATUSES as readonly string[]).includes(v)

export interface IssueReport {
  id: string
  category: IssueCategory
  title: string
  description: string
  page_url: string | null
  user_agent: string | null
  status: IssueStatus
  admin_note: string | null
  handled_at: string | null
  created_at: string
  updated_at: string
  reporter_name: string
  handler_name: string | null
}

/** select เดียวกันทุก route — ชื่อคนแจ้ง/คนจัดการ join จาก admin_users */
export const ISSUE_SELECT =
  'id, category, title, description, page_url, user_agent, status, admin_note, handled_at, created_at, updated_at, reporter:admin_users!issue_reports_reported_by_fkey(full_name, email), handler:admin_users!issue_reports_handled_by_fkey(full_name, email)'

type Who = { full_name: string | null; email: string } | null
const nameOf = (w: Who) => (w ? w.full_name?.trim() || w.email : null)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toIssue(r: any): IssueReport {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description,
    page_url: r.page_url,
    user_agent: r.user_agent,
    status: r.status,
    admin_note: r.admin_note,
    handled_at: r.handled_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
    reporter_name: nameOf(r.reporter) ?? '(ถูกลบ)',
    handler_name: nameOf(r.handler),
  }
}

