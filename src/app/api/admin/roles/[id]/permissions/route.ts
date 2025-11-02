/**
 * API Route: /api/admin/roles/[id]/permissions
 *
 * PUT: อัพเดท permissions ของ role
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PERMISSIONS } from '@/types/admin'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requirePermission(PERMISSIONS.ADMINS_MANAGE)

    const supabase = createServerSupabaseClient()
    const roleId = params.id
    const body = await request.json()
    const { permission_ids } = body

    // Validate input
    if (!permission_ids || !Array.isArray(permission_ids)) {
      return NextResponse.json(
        { error: 'Invalid input. Required: permission_ids (array)' },
        { status: 400 }
      )
    }

    // ตรวจสอบว่า role มีอยู่
    const { data: role } = await supabase
      .from('admin_roles')
      .select('id, is_system, name')
      .eq('id', roleId)
      .single()

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // ห้ามแก้ไข permissions ของ super_admin
    if (role.is_system && role.name === 'super_admin') {
      return NextResponse.json(
        { error: 'Cannot modify permissions of super_admin role' },
        { status: 403 }
      )
    }

    // ลบ permissions เก่าทั้งหมด
    const { error: deleteError } = await supabase
      .from('admin_role_permissions')
      .delete()
      .eq('role_id', roleId)

    if (deleteError) {
      console.error('Error deleting old permissions:', deleteError)
      return NextResponse.json(
        { error: 'Failed to update permissions' },
        { status: 500 }
      )
    }

    // เพิ่ม permissions ใหม่
    if (permission_ids.length > 0) {
      const rolePermissions = permission_ids.map((permId: string) => ({
        role_id: roleId,
        permission_id: permId,
      }))

      const { error: insertError } = await supabase
        .from('admin_role_permissions')
        .insert(rolePermissions)

      if (insertError) {
        console.error('Error inserting new permissions:', insertError)
        return NextResponse.json(
          { error: 'Failed to update permissions' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      message: 'Permissions updated successfully',
      permission_count: permission_ids.length,
    })
  } catch (error: any) {
    console.error('Role permissions PUT error:', error)

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
