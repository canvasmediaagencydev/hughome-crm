/**
 * GET  /api/admin/issues  — รายการแจ้งปัญหา (migration 028)
 *        issues.manage (super_admin = ผู้ดูแลระบบ canvas) → ทุกรายการ · ?status= กรองได้
 *        issues.report อย่างเดียว → เฉพาะรายการที่ตัวเองแจ้ง
 * POST /api/admin/issues  — แจ้งปัญหาใหม่ (issues.report · ทุก role)
 *        แจ้งทีมผ่าน notification_channels event 'issue.reported' หลังตอบแล้ว (after) — ส่งไม่ได้ไม่ทำให้แจ้งล้ม
 *
 * reported_by มาจาก session เท่านั้น ห้ามรับจาก body
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePermission, checkPermission, isSuperAdmin } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'
import { TENANT } from '@/config/tenant'
import { buildIssueReportedText, notifyTeam } from '@/lib/team-notify'
import {
  ISSUE_CATEGORY_LABEL,
  ISSUE_LIMITS,
  isIssueCategory,
  isIssueStatus,
  ISSUE_SELECT as SELECT,
  toIssue,
} from '@/lib/issue-reports'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const admin = await requirePermission(PERMISSIONS.ISSUES_REPORT)
    const [canManage, superAdmin] = await Promise.all([
      checkPermission(admin.id, PERMISSIONS.ISSUES_MANAGE),
      isSuperAdmin(admin.id),
    ])
    const seeAll = canManage || superAdmin

    const status = new URL(request.url).searchParams.get('status')
    const supabase = createServerSupabaseClient()
    let query = supabase.from('issue_reports').select(SELECT).order('created_at', { ascending: false }).limit(500)
    if (!seeAll) query = query.eq('reported_by', admin.id)
    if (status && isIssueStatus(status)) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      console.error('[issues] list failed:', error)
      return NextResponse.json({ error: 'ดึงรายการแจ้งปัญหาไม่สำเร็จ' }, { status: 500 })
    }
    return NextResponse.json({ canManage: seeAll, issues: (data ?? []).map(toIssue) })
  } catch (error) {
    console.error('[issues] GET unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'ดึงรายการแจ้งปัญหาไม่สำเร็จ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requirePermission(PERMISSIONS.ISSUES_REPORT)
    const body = await request.json().catch(() => ({}))

    const category = body.category
    const title = String(body.title ?? '').trim()
    const description = String(body.description ?? '').trim()
    const pageUrl = body.page_url ? String(body.page_url).slice(0, ISSUE_LIMITS.pageUrl) : null
    const userAgent = request.headers.get('user-agent')?.slice(0, ISSUE_LIMITS.userAgent) ?? null

    if (!isIssueCategory(category)) {
      return NextResponse.json({ error: 'เลือกประเภทปัญหา' }, { status: 400 })
    }
    if (title.length < 1 || title.length > ISSUE_LIMITS.title) {
      return NextResponse.json({ error: `หัวข้อต้องยาว 1–${ISSUE_LIMITS.title} ตัวอักษร` }, { status: 400 })
    }
    if (description.length < 1 || description.length > ISSUE_LIMITS.description) {
      return NextResponse.json(
        { error: `รายละเอียดต้องยาว 1–${ISSUE_LIMITS.description.toLocaleString('en-US')} ตัวอักษร` },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
      .from('issue_reports')
      .insert({ reported_by: admin.id, category, title, description, page_url: pageUrl, user_agent: userAgent })
      .select(SELECT)
      .single()
    if (error || !data) {
      console.error('[issues] insert failed:', error)
      return NextResponse.json({ error: 'บันทึกการแจ้งปัญหาไม่สำเร็จ' }, { status: 500 })
    }

    const text = buildIssueReportedText({
      tenantName: TENANT.name,
      reporterName: admin.full_name?.trim() || admin.email,
      categoryLabel: ISSUE_CATEGORY_LABEL[category],
      title,
      description,
      pageUrl,
      adminUrl: new URL('/admin/issues', request.url).toString(),
    })
    after(() => notifyTeam(supabase, 'issue.reported', text))

    return NextResponse.json(toIssue(data), { status: 201 })
  } catch (error) {
    console.error('[issues] POST unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'บันทึกการแจ้งปัญหาไม่สำเร็จ' }, { status: 500 })
  }
}
