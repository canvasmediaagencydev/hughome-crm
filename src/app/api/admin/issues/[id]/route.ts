/**
 * PATCH /api/admin/issues/:id — ผู้ดูแลระบบเปลี่ยนสถานะ / เขียนบันทึกการแก้ (issues.manage · super_admin)
 *   body: { status?: IssueStatus, admin_note?: string | null }
 *   handled_by / handled_at มาจาก session + เวลาตอนนี้ ห้ามรับจาก body
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { ISSUE_LIMITS, ISSUE_SELECT, isIssueStatus, toIssue } from '@/lib/issue-reports'

export const runtime = 'nodejs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requirePermission(PERMISSIONS.ISSUES_MANAGE)
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const now = new Date().toISOString()
    const updates: { status?: string; admin_note?: string | null; handled_by: string; handled_at: string; updated_at: string } = {
      handled_by: admin.id,
      handled_at: now,
      updated_at: now,
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      if (!isIssueStatus(body.status)) return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 })
      updates.status = body.status
    }
    if (Object.prototype.hasOwnProperty.call(body, 'admin_note')) {
      const note = body.admin_note == null ? '' : String(body.admin_note).trim()
      if (note.length > ISSUE_LIMITS.adminNote) {
        return NextResponse.json(
          { error: `บันทึกยาวเกิน ${ISSUE_LIMITS.adminNote.toLocaleString('en-US')} ตัวอักษร` },
          { status: 400 }
        )
      }
      updates.admin_note = note || null
    }
    if (updates.status === undefined && !('admin_note' in updates)) {
      return NextResponse.json({ error: 'ไม่มีอะไรให้แก้' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.from('issue_reports').update(updates).eq('id', id).select(ISSUE_SELECT).maybeSingle()
    if (error) {
      console.error('[issues/:id] update failed:', error)
      return NextResponse.json({ error: 'อัปเดตรายการไม่สำเร็จ' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'ไม่พบรายการนี้' }, { status: 404 })
    return NextResponse.json(toIssue(data))
  } catch (error) {
    console.error('[issues/:id] PATCH unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'อัปเดตรายการไม่สำเร็จ' }, { status: 500 })
  }
}
