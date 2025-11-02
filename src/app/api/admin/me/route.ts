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

    // 1. Get admin_users data
    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single()

    if (adminError || !admin) {
      return NextResponse.json(
        { error: 'Admin user not found or inactive' },
        { status: 403 }
      )
    }

    // 2. Get roles
    const { data: userRoles } = await supabase
      .from('admin_user_roles')
      .select(`
        role:admin_roles (
          id,
          name,
          display_name,
          description,
          is_system,
          created_at,
          updated_at
        )
      `)
      .eq('admin_user_id', admin.id)

    const roles = userRoles?.map((ur: any) => ur.role).filter(Boolean) || []

    // 3. Get permissions
    const { data: rolePermissions } = await supabase
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
      .eq('admin_user_id', admin.id)

    // Flatten permissions
    const permissionSet = new Set<string>()
    rolePermissions?.forEach((item: any) => {
      item.role?.permissions?.forEach((perm: any) => {
        if (perm.permission?.permission_key) {
          permissionSet.add(perm.permission.permission_key)
        }
      })
    })

    const permissions = Array.from(permissionSet)

    return NextResponse.json({
      adminUser: admin,
      roles,
      permissions
    })
  } catch (error) {
    console.error('Error in /api/admin/me:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
