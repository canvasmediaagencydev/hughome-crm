/**
 * API Route: /api/admin/roles
 *
 * GET: ดึง roles ทั้งหมดพร้อมสถิติ
 * POST: สร้าง role ใหม่
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/admin-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PERMISSIONS } from '@/types/admin'

export async function GET() {
  try {
    // ทุก admin ดู roles ได้
    await requirePermission(PERMISSIONS.ADMINS_MANAGE)

    const supabase = createServerSupabaseClient()

    // ดึง roles ทั้งหมด
    const { data: roles, error: rolesError } = await supabase
      .from('admin_roles')
      .select('*')
      .order('is_system', { ascending: false })
      .order('name', { ascending: true })

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return NextResponse.json(
        { error: 'Failed to fetch roles' },
        { status: 500 }
      )
    }

    // นับจำนวน permissions และ users ของแต่ละ role
    const rolesWithStats = await Promise.all(
      roles.map(async (role) => {
        // นับ permissions
        const { count: permissionCount } = await supabase
          .from('admin_role_permissions')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id)

        // นับ users
        const { count: userCount } = await supabase
          .from('admin_user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id)

        return {
          ...role,
          permission_count: permissionCount || 0,
          user_count: userCount || 0,
        }
      })
    )

    return NextResponse.json({
      roles: rolesWithStats,
      total: roles.length,
    })
  } catch (error: any) {
    console.error('Roles GET error:', error)

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

export async function POST(request: NextRequest) {
  try {
    // ต้องมี admins.manage permission
    const adminUser = await requirePermission(PERMISSIONS.ADMINS_MANAGE)

    const body = await request.json()
    const { name, display_name, description, permission_ids } = body

    // Validate input
    if (!name || !display_name || !permission_ids || !Array.isArray(permission_ids)) {
      return NextResponse.json(
        { error: 'Invalid input. Required: name, display_name, permission_ids (array)' },
        { status: 400 }
      )
    }

    // ตรวจสอบว่าชื่อ role ซ้ำหรือไม่
    const supabase = createServerSupabaseClient()

    const { data: existingRole } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('name', name)
      .single()

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role name already exists' },
        { status: 409 }
      )
    }

    // สร้าง role ใหม่
    const { data: newRole, error: roleError } = await supabase
      .from('admin_roles')
      .insert({
        name,
        display_name,
        description: description || null,
        is_system: false,
      })
      .select()
      .single()

    if (roleError || !newRole) {
      console.error('Error creating role:', roleError)
      return NextResponse.json(
        { error: 'Failed to create role' },
        { status: 500 }
      )
    }

    // เพิ่ม permissions ให้ role
    if (permission_ids.length > 0) {
      const rolePermissions = permission_ids.map((permId: string) => ({
        role_id: newRole.id,
        permission_id: permId,
      }))

      const { error: permError } = await supabase
        .from('admin_role_permissions')
        .insert(rolePermissions)

      if (permError) {
        console.error('Error adding permissions:', permError)
        // Rollback: ลบ role ที่สร้างไป
        await supabase.from('admin_roles').delete().eq('id', newRole.id)

        return NextResponse.json(
          { error: 'Failed to assign permissions' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        message: 'Role created successfully',
        role: newRole,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Roles POST error:', error)

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
