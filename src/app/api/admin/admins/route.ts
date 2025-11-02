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

// GET /api/admin/admins - List all admins
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token or user not found' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminUser) {
      return NextResponse.json(
        { error: 'User is not an admin' },
        { status: 403 }
      )
    }

    // Check permission
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
      return NextResponse.json(
        { error: 'You do not have permission to manage admins' },
        { status: 403 }
      )
    }

    // Fetch all admins with their roles
    // Use !admin_user_roles_admin_user_id_fkey to specify which foreign key to use
    const { data: admins, error: adminsError } = await supabase
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
      .order('created_at', { ascending: false })

    if (adminsError) {
      throw adminsError
    }

    // Transform data
    const adminsWithRoles = admins.map((admin: any) => ({
      ...admin,
      roles: admin.roles?.map((r: any) => r.role).filter(Boolean) || []
    }))

    return NextResponse.json({
      admins: adminsWithRoles
    })
  } catch (error) {
    console.error('Error in GET /api/admin/admins:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/admin/admins - Create new admin
export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token or user not found' },
        { status: 401 }
      )
    }

    // Check if user is admin with permission
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id, is_active')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!adminUser) {
      return NextResponse.json(
        { error: 'User is not an admin' },
        { status: 403 }
      )
    }

    // Check permission
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
      return NextResponse.json(
        { error: 'You do not have permission to manage admins' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { email, password, full_name, role_ids } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createUserError) {
      return NextResponse.json(
        { error: createUserError.message },
        { status: 400 }
      )
    }

    if (!newUser.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Create admin_users record
    const { data: newAdmin, error: createAdminError } = await supabase
      .from('admin_users')
      .insert({
        auth_user_id: newUser.user.id,
        email,
        full_name: full_name || null,
        is_active: true
      })
      .select()
      .single()

    if (createAdminError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: createAdminError.message },
        { status: 400 }
      )
    }

    // Assign roles if provided
    if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
      const roleAssignments = role_ids.map((roleId: string) => ({
        admin_user_id: newAdmin.id,
        role_id: roleId
      }))

      const { error: assignRolesError } = await supabase
        .from('admin_user_roles')
        .insert(roleAssignments)

      if (assignRolesError) {
        console.error('Error assigning roles:', assignRolesError)
        // Don't rollback - admin is created, just missing roles
      }
    }

    return NextResponse.json({
      admin: newAdmin
    }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/admin/admins:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
