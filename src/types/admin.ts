/**
 * Admin RBAC Type Definitions
 *
 * Types สำหรับระบบ Admin Role-Based Access Control
 * แยกจาก User (LINE Login) โดยสิ้นเชิง
 */

// ============================================================================
// Admin User Types
// ============================================================================

export interface AdminUser {
  id: string
  auth_user_id: string
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  last_login_at: string | null
}

export interface AdminUserWithRoles extends AdminUser {
  roles: AdminRole[]
  permissions: string[]
}

// ============================================================================
// Role Types
// ============================================================================

export interface AdminRole {
  id: string
  name: string
  display_name: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface AdminRoleWithPermissions extends AdminRole {
  permissions: AdminPermission[]
  permission_count: number
}

export interface AdminRoleWithStats extends AdminRole {
  permission_count: number
  user_count: number
}

// ============================================================================
// Permission Types
// ============================================================================

export interface AdminPermission {
  id: string
  permission_key: string
  category: string
  display_name: string
  description: string | null
  created_at: string
}

export type PermissionCategory =
  | 'dashboard'
  | 'receipts'
  | 'users'
  | 'rewards'
  | 'redemptions'
  | 'settings'
  | 'admins'

export interface PermissionsByCategory {
  category: PermissionCategory
  permissions: AdminPermission[]
}

// ============================================================================
// Role-Permission Mapping
// ============================================================================

export interface AdminRolePermission {
  id: string
  role_id: string
  permission_id: string
  created_at: string
}

// ============================================================================
// User-Role Mapping
// ============================================================================

export interface AdminUserRole {
  id: string
  admin_user_id: string
  role_id: string
  assigned_by: string | null
  assigned_at: string
}

export interface AdminUserRoleWithDetails extends AdminUserRole {
  role: AdminRole
  assigned_by_admin: AdminUser | null
}

// ============================================================================
// Permission Keys (for type safety)
// ============================================================================

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Receipts
  RECEIPTS_VIEW: 'receipts.view',
  RECEIPTS_APPROVE: 'receipts.approve',
  RECEIPTS_REJECT: 'receipts.reject',
  RECEIPTS_AUTO_PROCESS: 'receipts.auto_process',

  // Users
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_MANAGE_POINTS: 'users.manage_points',
  USERS_MANAGE_NOTES: 'users.manage_notes',

  // Rewards
  REWARDS_VIEW: 'rewards.view',
  REWARDS_CREATE: 'rewards.create',
  REWARDS_EDIT: 'rewards.edit',
  REWARDS_DELETE: 'rewards.delete',

  // Redemptions
  REDEMPTIONS_VIEW: 'redemptions.view',
  REDEMPTIONS_PROCESS: 'redemptions.process',

  // Settings
  SETTINGS_EDIT: 'settings.edit',

  // Admins
  ADMINS_MANAGE: 'admins.manage',
} as const

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS]

// ============================================================================
// Default Role Names (for type safety)
// ============================================================================

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  RECEIPT_MANAGER: 'receipt_manager',
  CUSTOMER_SUPPORT: 'customer_support',
  REWARD_MANAGER: 'reward_manager',
} as const

export type RoleName = typeof ROLES[keyof typeof ROLES]

// ============================================================================
// Form/Request Types
// ============================================================================

export interface CreateAdminRequest {
  email: string
  password: string
  full_name?: string
  role_ids: string[]
}

export interface UpdateAdminRequest {
  full_name?: string
  is_active?: boolean
}

export interface UpdateAdminRolesRequest {
  role_ids: string[]
}

export interface CreateRoleRequest {
  name: string
  display_name: string
  description?: string
  permission_ids: string[]
}

export interface UpdateRoleRequest {
  display_name?: string
  description?: string
}

export interface UpdateRolePermissionsRequest {
  permission_ids: string[]
}

// ============================================================================
// Response Types
// ============================================================================

export interface AdminAuthResponse {
  admin_user: AdminUserWithRoles
  is_super_admin: boolean
}

export interface CheckPermissionResponse {
  has_permission: boolean
  permission_key: string
}

// ============================================================================
// Context Types (for React)
// ============================================================================

export interface AdminAuthContextType {
  adminUser: AdminUser | null
  roles: AdminRole[]
  permissions: string[]
  isLoading: boolean
  isSuperAdmin: boolean
  hasPermission: (permission: PermissionKey | string) => boolean
  hasAnyPermission: (permissions: (PermissionKey | string)[]) => boolean
  hasAllPermissions: (permissions: (PermissionKey | string)[]) => boolean
  refetch: () => Promise<void>
}
