/**
 * API Route: /api/admin/permissions
 *
 * GET: ดึง permissions ทั้งหมด (สำหรับ UI dropdowns/checkboxes)
 */

import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { AdminPermission } from '@/types/admin'

export async function GET() {
  try {
    // ตรวจสอบว่าเป็น admin (ทุกคนที่เป็น admin ดูได้)
    await requireAdmin()

    const supabase = createServerSupabaseClient()

    // ดึง permissions ทั้งหมด จัดกลุ่มตาม category
    const { data: permissions, error } = await supabase
      .from('admin_permissions')
      .select('*')
      .order('category', { ascending: true })
      .order('permission_key', { ascending: true })

    if (error) {
      console.error('Error fetching permissions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch permissions' },
        { status: 500 }
      )
    }

    // จัดกลุ่มตาม category
    const permissionList = (permissions ?? []) as AdminPermission[]

    const grouped = permissionList.reduce((acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = []
      }
      acc[perm.category].push(perm)
      return acc
    }, {} as Record<string, AdminPermission[]>)

    return NextResponse.json({
      permissions: permissionList,
      grouped,
      total: permissionList.length,
    })
  } catch (error: any) {
    console.error('Permissions API error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
