/**
 * Admin Authentication & Authorization Utilities
 *
 * Server-side utilities สำหรับตรวจสอบสิทธิ์ admin
 * ใช้กับ API routes และ Server Components
 */

import { createServerSupabaseClient } from '@/lib/supabase-server'
import type {
  AdminUser,
  AdminRole,
  AdminUserWithRoles,
  PermissionKey,
} from '@/types/admin'

// ============================================================================
// Admin Session Verification
// ============================================================================

/**
 * ตรวจสอบว่า auth user เป็น admin หรือไม่
 * @param authUserId - UUID จาก auth.users
 * @returns AdminUser | null
 */
export async function verifyAdminSession(
  authUserId: string
): Promise<AdminUser | null> {
  const supabase = createServerSupabaseClient()

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .single()

  if (error || !adminUser) {
    return null
  }

  return adminUser
}

/**
 * ดึงข้อมูล admin พร้อม roles และ permissions
 * @param authUserId - UUID จาก auth.users
 * @returns AdminUserWithRoles | null
 */
export async function getAdminWithRoles(
  authUserId: string
): Promise<AdminUserWithRoles | null> {
  const adminUser = await verifyAdminSession(authUserId)
  if (!adminUser) return null

  const roles = await getAdminRoles(adminUser.id)
  const permissions = await getAdminPermissions(adminUser.id)

  return {
    ...adminUser,
    roles,
    permissions,
  }
}

// ============================================================================
// Role Queries
// ============================================================================

/**
 * ดึง roles ทั้งหมดของ admin
 * @param adminUserId - UUID จาก admin_users
 * @returns AdminRole[]
 */
export async function getAdminRoles(
  adminUserId: string
): Promise<AdminRole[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('admin_user_roles')
    .select(
      `
      role:admin_roles (
        id,
        name,
        display_name,
        description,
        is_system,
        created_at,
        updated_at
      )
    `
    )
    .eq('admin_user_id', adminUserId)

  if (error || !data) {
    return []
  }

  return data.map((item: any) => item.role).filter(Boolean)
}

/**
 * ตรวจสอบว่า admin มี role นี้หรือไม่
 * @param adminUserId - UUID จาก admin_users
 * @param roleName - ชื่อ role (เช่น 'super_admin')
 * @returns boolean
 */
export async function hasRole(
  adminUserId: string,
  roleName: string
): Promise<boolean> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('admin_user_roles')
    .select(
      `
      role:admin_roles!inner (name)
    `
    )
    .eq('admin_user_id', adminUserId)
    .eq('admin_roles.name', roleName)
    .limit(1)

  return !error && data && data.length > 0
}

// ============================================================================
// Permission Queries
// ============================================================================

/**
 * ดึง permissions ทั้งหมดของ admin (จาก roles ทั้งหมด)
 * @param adminUserId - UUID จาก admin_users
 * @returns string[] - array ของ permission_key
 */
export async function getAdminPermissions(
  adminUserId: string
): Promise<string[]> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('admin_user_roles')
    .select(
      `
      role:admin_roles!inner (
        permissions:admin_role_permissions (
          permission:admin_permissions (
            permission_key
          )
        )
      )
    `
    )
    .eq('admin_user_id', adminUserId)

  if (error || !data) {
    return []
  }

  // Flatten permissions จาก roles ทั้งหมด
  const permissions = new Set<string>()

  data.forEach((item: any) => {
    if (item.role?.permissions) {
      item.role.permissions.forEach((perm: any) => {
        if (perm.permission?.permission_key) {
          permissions.add(perm.permission.permission_key)
        }
      })
    }
  })

  return Array.from(permissions)
}

/**
 * ตรวจสอบว่า admin มี permission นี้หรือไม่
 * @param adminUserId - UUID จาก admin_users
 * @param permissionKey - permission key (เช่น 'receipts.approve')
 * @returns boolean
 */
export async function checkPermission(
  adminUserId: string,
  permissionKey: PermissionKey | string
): Promise<boolean> {
  const permissions = await getAdminPermissions(adminUserId)
  return permissions.includes(permissionKey)
}

/**
 * ตรวจสอบว่า admin มี permission ใดๆ ใน array หรือไม่
 * @param adminUserId - UUID จาก admin_users
 * @param permissionKeys - array ของ permission keys
 * @returns boolean - true ถ้ามีอย่างน้อย 1 permission
 */
export async function hasAnyPermission(
  adminUserId: string,
  permissionKeys: (PermissionKey | string)[]
): Promise<boolean> {
  const permissions = await getAdminPermissions(adminUserId)
  return permissionKeys.some((key) => permissions.includes(key))
}

/**
 * ตรวจสอบว่า admin มี permissions ทั้งหมดใน array หรือไม่
 * @param adminUserId - UUID จาก admin_users
 * @param permissionKeys - array ของ permission keys
 * @returns boolean - true ถ้ามีครบทุก permission
 */
export async function hasAllPermissions(
  adminUserId: string,
  permissionKeys: (PermissionKey | string)[]
): Promise<boolean> {
  const permissions = await getAdminPermissions(adminUserId)
  return permissionKeys.every((key) => permissions.includes(key))
}

// ============================================================================
// Super Admin Check
// ============================================================================

/**
 * ตรวจสอบว่าเป็น Super Admin หรือไม่
 * @param adminUserId - UUID จาก admin_users
 * @returns boolean
 */
export async function isSuperAdmin(adminUserId: string): Promise<boolean> {
  return hasRole(adminUserId, 'super_admin')
}

// ============================================================================
// Authorization Guards (สำหรับ API routes)
// ============================================================================

/**
 * Guard function สำหรับ API routes
 * ตรวจสอบว่า request มาจาก admin ที่ active
 * @throws Error ถ้าไม่ใช่ admin
 * @returns AdminUser
 */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const adminUser = await verifyAdminSession(user.id)

  if (!adminUser) {
    throw new Error('Forbidden: Not an admin')
  }

  return adminUser
}

/**
 * Guard function ที่ต้องการ permission
 * @param permissionKey - permission ที่ต้องการ
 * @throws Error ถ้าไม่มี permission
 * @returns AdminUser
 */
export async function requirePermission(
  permissionKey: PermissionKey | string
): Promise<AdminUser> {
  const adminUser = await requireAdmin()

  const hasPermission = await checkPermission(adminUser.id, permissionKey)

  if (!hasPermission) {
    throw new Error(`Forbidden: Missing permission '${permissionKey}'`)
  }

  return adminUser
}

/**
 * Guard function ที่ต้องการ Super Admin
 * @throws Error ถ้าไม่ใช่ Super Admin
 * @returns AdminUser
 */
export async function requireSuperAdmin(): Promise<AdminUser> {
  const adminUser = await requireAdmin()

  const isSuperAdminUser = await isSuperAdmin(adminUser.id)

  if (!isSuperAdminUser) {
    throw new Error('Forbidden: Super Admin only')
  }

  return adminUser
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * อัพเดท last_login_at
 * @param adminUserId - UUID จาก admin_users
 */
export async function updateLastLogin(adminUserId: string): Promise<void> {
  const supabase = createServerSupabaseClient()

  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', adminUserId)
}

/**
 * ดึงข้อมูล admin พร้อมสถิติ (สำหรับ admin list page)
 */
export async function getAdminWithStats(adminUserId: string) {
  const supabase = createServerSupabaseClient()

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', adminUserId)
    .single()

  if (!adminUser) return null

  const roles = await getAdminRoles(adminUserId)
  const permissions = await getAdminPermissions(adminUserId)

  return {
    ...adminUser,
    roles,
    role_count: roles.length,
    permission_count: permissions.length,
  }
}
