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

// Helper function to check admin permission
async function checkAdminPermission(token: string) {
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return { error: 'Invalid token or user not found', status: 401 }
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('id, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!adminUser) {
    return { error: 'User is not an admin', status: 403 }
  }

  const { data: permissions } = await supabase
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
    .eq('admin_user_id', adminUser.id)

  const permissionSet = new Set<string>()
  permissions?.forEach((item: any) => {
    item.role?.permissions?.forEach((perm: any) => {
      if (perm.permission?.permission_key) {
        permissionSet.add(perm.permission.permission_key)
      }
    })
  })

  if (!permissionSet.has('admins.manage')) {
    return { error: 'You do not have permission to manage admins', status: 403 }
  }

  return { adminUser, permissions: permissionSet }
}

// GET /api/admin/admins/[id] - Get admin by ID
export async function GET(
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
    const permissionCheck = await checkAdminPermission(token)

    if ('error' in permissionCheck) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    // Fetch admin with roles
    const { id } = await context.params

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select(`
        *,
        roles:admin_user_roles!admin_user_roles_admin_user_id_fkey (
          role:admin_roles (
            id,
            name,
            display_name,
            description
          )
        )
      `)
      .eq('id', id)
      .single()

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    // Transform data
    const adminWithRoles = {
      ...admin,
      roles: admin.roles?.map((r: any) => r.role).filter(Boolean) || []
    }

    return NextResponse.json({ admin: adminWithRoles })
  } catch (error) {
    console.error('Error in GET /api/admin/admins/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/admins/[id] - Update admin
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
    const permissionCheck = await checkAdminPermission(token)

    if ('error' in permissionCheck) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    const { id } = await context.params

    const body = await request.json()
    const { full_name, is_active } = body

    // Update admin_users record
    const { data: updatedAdmin, error: updateError } = await supabase
      .from('admin_users')
      .update({
        ...(full_name !== undefined && { full_name }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ admin: updatedAdmin })
  } catch (error) {
    console.error('Error in PUT /api/admin/admins/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/admins/[id] - Soft delete (deactivate) admin
export async function DELETE(
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
    const permissionCheck = await checkAdminPermission(token)

    if ('error' in permissionCheck) {
      return NextResponse.json(
        { error: permissionCheck.error },
        { status: permissionCheck.status }
      )
    }

    // Soft delete: set is_active = false
    const { id } = await context.params

    const { data: deletedAdmin, error: deleteError } = await supabase
      .from('admin_users')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ admin: deletedAdmin })
  } catch (error) {
    console.error('Error in DELETE /api/admin/admins/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
