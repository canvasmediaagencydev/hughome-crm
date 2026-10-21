/**
 * GET /api/admin/inbox — งานที่รอ "คนนี้" กด (กระดิ่งขวาบน + จุดแดงที่เมนู · ประชุมลูกค้า 2026-10-21)
 *
 * นับสดจากตารางจริงทุกครั้ง ไม่มีตารางแจ้งเตือนแยก → ไม่มี migration และไม่มีทางที่ตัวเลขค้าง
 * หลังมีคนกดไปแล้ว (งานหายจากกระดิ่งเองเมื่อสถานะเปลี่ยน) · แสดงเฉพาะงานที่ role นี้มีสิทธิ์ทำ:
 *
 *   batches.approve      ชุดยอดขายรออนุมัติ (pending_approval)          → /admin/batches
 *   batches.upload       ชุดที่ตรวจแล้วยังไม่ส่งให้ผู้อนุมัติ (previewed)  → /admin/batches
 *   redemptions.process  คำขอแลกรางวัลรอดำเนินการ (requested) / รอเตรียมของ (approved) → /admin/redemptions
 *   issues.manage        แจ้งปัญหาที่ยังไม่รับเรื่อง (open)               → /admin/issues
 *   users.edit           ลูกค้ายังไม่มีรหัส                              → /admin/users?no_code=1
 *
 * super_admin เห็นทุกข้อ · admin ทุกคนเรียกได้ (requireAdmin) — สิทธิ์ตัดสินต่อรายการ
 */
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin, getAdminPermissions, isSuperAdmin } from '@/lib/admin-auth'
import { adminAuthError } from '@/lib/admin-http'
import { PERMISSIONS } from '@/types/admin'

export const dynamic = 'force-dynamic'

export interface InboxItem {
  key: string
  title: string
  count: number
  /** หน้าที่ต้องเข้าไปกด — ใช้จับคู่จุดแดงกับเมนูด้วย */
  href: string
}

export async function GET() {
  try {
    const admin = await requireAdmin()
    const [perms, superAdmin] = await Promise.all([getAdminPermissions(admin.id), isSuperAdmin(admin.id)])
    const can = (p: string) => superAdmin || perms.includes(p)
    const supabase = createServerSupabaseClient()

    type Count = { count: number | null; error: { message: string } | null }
    const jobs: { key: string; title: string; href: string; run: () => PromiseLike<Count> }[] = []

    if (can(PERMISSIONS.BATCHES_APPROVE)) {
      jobs.push({
        key: 'batches_pending_approval',
        title: 'ชุดยอดขายรออนุมัติ',
        href: '/admin/batches',
        run: () => supabase.from('point_batches').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      })
    }
    if (can(PERMISSIONS.BATCHES_UPLOAD)) {
      jobs.push({
        key: 'batches_previewed',
        title: 'ชุดยอดขายตรวจแล้ว ยังไม่ส่งให้ผู้อนุมัติ',
        href: '/admin/batches',
        run: () => supabase.from('point_batches').select('id', { count: 'exact', head: true }).eq('status', 'previewed'),
      })
    }
    if (can(PERMISSIONS.REDEMPTIONS_PROCESS)) {
      jobs.push({
        key: 'redemptions_requested',
        title: 'คำขอแลกรางวัลรอดำเนินการ',
        href: '/admin/redemptions',
        run: () => supabase.from('redemptions').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      })
      jobs.push({
        key: 'redemptions_approved',
        title: 'รางวัลอนุมัติแล้ว รอเตรียมของ',
        href: '/admin/redemptions',
        run: () => supabase.from('redemptions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      })
    }
    if (can(PERMISSIONS.ISSUES_MANAGE)) {
      jobs.push({
        key: 'issues_open',
        title: 'แจ้งปัญหาใหม่ ยังไม่รับเรื่อง',
        href: '/admin/issues',
        run: () => supabase.from('issue_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      })
    }
    if (can(PERMISSIONS.USERS_EDIT)) {
      jobs.push({
        key: 'customers_missing_code',
        title: 'ลูกค้าใหม่ยังไม่มีรหัสลูกค้า',
        href: '/admin/users?no_code=1',
        run: () =>
          supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .not('role', 'is', null)
            .is('customer_code', null),
      })
    }

    const results = await Promise.all(jobs.map((j) => j.run()))
    const items: InboxItem[] = []
    results.forEach((r, i) => {
      // นับไม่ได้ = ไม่โชว์รายการนั้น แต่ต้องเห็นใน log (ไม่ทำให้ทั้งกระดิ่งพัง)
      if (r.error) {
        console.error(`[admin/inbox] ${jobs[i].key} failed:`, r.error.message)
        return
      }
      const count = r.count ?? 0
      if (count > 0) items.push({ key: jobs[i].key, title: jobs[i].title, href: jobs[i].href, count })
    })

    return NextResponse.json({ items, total: items.reduce((s, x) => s + x.count, 0) })
  } catch (error) {
    console.error('[admin/inbox] unexpected:', error)
    return adminAuthError(error) ?? NextResponse.json({ error: 'โหลดการแจ้งเตือนไม่สำเร็จ' }, { status: 500 })
  }
}
