/**
 * API Route: /api/admin/roles/[id]
 *
 * GET: ดึงข้อมูล role พร้อม permissions
 * PUT: อัพเดท role (name, display_name, description)
 * DELETE: ลบ role (ถ้าไม่ใช่ system role)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PERMISSIONS } from '@/types/admin'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMINS_MANAGE)

    const supabase = createServerSupabaseClient()
    const { id: roleId } = await context.params

    // ดึงข้อมูล role
    const { data: role, error: roleError } = await supabase
      .from('admin_roles')
      .select('*')
      .eq('id', roleId)
      .single()

    if (roleError || !role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // ดึง permissions ของ role นี้
    const { data: rolePerms } = await supabase
      .from('admin_role_permissions')
      .select(`
        permission:admin_permissions (*)
      `)
      .eq('role_id', roleId)

    const permissions = rolePerms?.map((rp: any) => rp.permission).filter(Boolean) || []

    return NextResponse.json({
      role: {
        ...role,
        permissions,
        permission_count: permissions.length,
      },
    })
  } catch (error: any) {
    console.error('Role GET error:', error)

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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMINS_MANAGE)

    const supabase = createServerSupabaseClient()
    const { id: roleId } = await context.params
    const body = await request.json()
    const { display_name, description } = body

    // ตรวจสอบว่า role มีอยู่และไม่ใช่ system role
    const { data: role } = await supabase
      .from('admin_roles')
      .select('is_system')
      .eq('id', roleId)
      .single()

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // ห้ามแก้ไข system role (เฉพาะ description ได้)
    if (role.is_system && display_name) {
      return NextResponse.json(
        { error: 'Cannot modify system role name' },
        { status: 403 }
      )
    }

    // อัพเดท role
    const updateData: any = {}
    if (display_name) updateData.display_name = display_name
    if (description !== undefined) updateData.description = description

    const { data: updatedRole, error } = await supabase
      .from('admin_roles')
      .update(updateData)
      .eq('id', roleId)
      .select()
      .single()

    if (error) {
      console.error('Error updating role:', error)
      return NextResponse.json(
        { error: 'Failed to update role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Role updated successfully',
      role: updatedRole,
    })
  } catch (error: any) {
    console.error('Role PUT error:', error)

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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(PERMISSIONS.ADMINS_MANAGE)

    const supabase = createServerSupabaseClient()
    const { id: roleId } = await context.params

    // ตรวจสอบว่า role มีอยู่และไม่ใช่ system role
    const { data: role } = await supabase
      .from('admin_roles')
      .select('is_system, name')
      .eq('id', roleId)
      .single()

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    if (role.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system role' },
        { status: 403 }
      )
    }

    // ตรวจสอบว่ามีคนใช้ role นี้อยู่หรือไม่
    const { count } = await supabase
      .from('admin_user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', roleId)

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete role. ${count} admin(s) are using this role.`,
        },
        { status: 409 }
      )
    }

    // ลบ role (CASCADE จะลบ role_permissions ด้วย)
    const { error } = await supabase
      .from('admin_roles')
      .delete()
      .eq('id', roleId)

    if (error) {
      console.error('Error deleting role:', error)
      return NextResponse.json(
        { error: 'Failed to delete role' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Role deleted successfully',
    })
  } catch (error: any) {
    console.error('Role DELETE error:', error)

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
