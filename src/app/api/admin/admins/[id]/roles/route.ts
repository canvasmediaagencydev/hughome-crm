import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token or user not found' },
        { status: 401 }
      )
    }

    const { data: actingAdmin } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!actingAdmin) {
      return NextResponse.json(
        { error: 'User is not an admin' },
        { status: 403 }
      )
    }

    const { data: permissionRows } = await supabase
      .from('admin_user_roles')
      .select(`
        role:admin_roles!inner (
          permissions:admin_role_permissions (
            permission:admin_permissions (
              permission_key
            )
          )
        )
      `)
      .eq('admin_user_id', actingAdmin.id)

    const permissionSet = new Set<string>()
    permissionRows?.forEach((row: any) => {
      row.role?.permissions?.forEach((perm: any) => {
        if (perm.permission?.permission_key) {
          permissionSet.add(perm.permission.permission_key)
        }
      })
    })

    if (!permissionSet.has('admins.manage')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage admins' },
        { status: 403 }
      )
    }

    const { data: actingRoleRows } = await supabase
      .from('admin_user_roles')
      .select(
        `
        role:admin_roles (
          name
        )
      `
      )
      .eq('admin_user_id', actingAdmin.id)

    const actingIsSuperAdmin = !!actingRoleRows?.some(
      (item: any) => item.role?.name === 'super_admin'
    )

    const { id: adminId } = await context.params
    const body = await request.json()
    const { role_ids } = body

    if (!Array.isArray(role_ids)) {
      return NextResponse.json(
        { error: 'Invalid input. Required: role_ids (array)' },
        { status: 400 }
      )
    }

    const roleIds = Array.from(
      new Set(
        role_ids
          .filter((roleId: unknown): roleId is string => typeof roleId === 'string' && roleId.trim().length > 0)
          .map((roleId: string) => roleId.trim())
      )
    )

    const { data: targetAdmin, error: targetAdminError } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('id', adminId)
      .single()

    if (targetAdminError || !targetAdmin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    const { data: existingRoles } = await supabase
      .from('admin_user_roles')
      .select(
        `
        role:admin_roles (
          id,
          name
        )
      `
      )
      .eq('admin_user_id', adminId)

    const existingRolesList = (existingRoles ?? []) as any[]

    const existingHasSuperAdmin = existingRolesList.some(
      (item: any) => item?.role?.name === 'super_admin'
    )

    let validRoles: { id: string; name: string }[] = []

    if (roleIds.length > 0) {
      const { data, error: rolesError } = await supabase
        .from('admin_roles')
        .select('id, name')
        .in('id', roleIds)

      if (rolesError) {
        return NextResponse.json(
          { error: 'Failed to validate roles' },
          { status: 500 }
        )
      }

      validRoles = (data || []) as { id: string; name: string }[]
    }

    if (roleIds.length !== validRoles.length) {
      return NextResponse.json(
        { error: 'Some roles are invalid' },
        { status: 400 }
      )
    }

    const newHasSuperAdmin = validRoles.some((role: any) => role?.name === 'super_admin')

    if ((existingHasSuperAdmin || newHasSuperAdmin) && !actingIsSuperAdmin) {
      return NextResponse.json(
        { error: 'Only super admins can manage super admin role assignments' },
        { status: 403 }
      )
    }

    if (existingHasSuperAdmin && !newHasSuperAdmin) {
      const superAdminRole = existingRolesList.find(
        (item: any) => item?.role?.name === 'super_admin'
      )?.role as { id?: string } | undefined

      if (superAdminRole?.id) {
        const { count: otherSuperAdmins, error: countError } = await supabase
          .from('admin_user_roles')
          .select('admin_user_id', { count: 'exact', head: true })
          .eq('role_id', superAdminRole.id)
          .neq('admin_user_id', adminId)

        if (countError) {
          return NextResponse.json(
            { error: 'Failed to verify super admin assignments' },
            { status: 500 }
          )
        }

        if (!otherSuperAdmins || otherSuperAdmins === 0) {
          return NextResponse.json(
            { error: 'ระบบต้องมี Super Admin อย่างน้อย 1 คน' },
            { status: 400 }
          )
        }
      }
    }

    const { error: deleteError } = await supabase
      .from('admin_user_roles')
      .delete()
      .eq('admin_user_id', adminId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to update roles' },
        { status: 500 }
      )
    }

    if (roleIds.length > 0) {
      const roleAssignments = roleIds.map((roleId) => ({
        admin_user_id: adminId,
        role_id: roleId
      }))

      const { error: insertError } = await supabase
        .from('admin_user_roles')
        .insert(roleAssignments)

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to assign roles' },
          { status: 500 }
        )
      }
    }

    await supabase
      .from('admin_users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', adminId)

    const { data: updatedAdmin, error: refreshError } = await supabase
      .from('admin_users')
      .select(
        `
        *,
        roles:admin_user_roles!admin_user_roles_admin_user_id_fkey (
          role:admin_roles (
            id,
            name,
            display_name,
            description
          )
        )
      `
      )
      .eq('id', adminId)
      .single()

    if (refreshError || !updatedAdmin) {
      return NextResponse.json(
        { error: 'Failed to load updated admin' },
        { status: 500 }
      )
    }

    const adminWithRoles = {
      ...updatedAdmin,
      roles: updatedAdmin.roles?.map((item: any) => item.role).filter(Boolean) ?? []
    }

    return NextResponse.json({ admin: adminWithRoles })
  } catch (error) {
    console.error('Error updating admin roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
