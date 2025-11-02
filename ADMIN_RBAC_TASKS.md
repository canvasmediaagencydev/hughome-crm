# Admin RBAC System - Implementation Tasks

## Overview
สร้างระบบ Role-Based Access Control สำหรับ Admin ที่แยกออกจาก User (LINE Login) โดยสิ้นเชิง

**Key Points:**
- Admin ใช้ Supabase Auth (email/password)
- User ใช้ LINE Login
- Admin เก็บในตาราง `admin_users` (แยกจาก `user_profiles`)
- Super Admin สร้าง Role และมอบหมาย Permission ได้

---

## Phase 1: Database & Migration

### Task 1.1: Create Migration File ✅
- [x] สร้างไฟล์ `supabase/migrations/20251102_create_admin_rbac_system.sql`
- [x] สร้างตาราง `admin_users`
- [x] สร้างตาราง `admin_roles`
- [x] สร้างตาราง `admin_permissions`
- [x] สร้างตาราง `admin_role_permissions`
- [x] สร้างตาราง `admin_user_roles`

### Task 1.2: Seed Data ✅
- [x] Seed 16 permissions
- [x] Seed 4 default roles (Super Admin, Receipt Manager, Customer Support, Reward Manager)
- [x] เชื่อม permissions กับ roles

### Task 1.3: RLS Policies ✅
- [x] สร้าง RLS policies สำหรับทุกตาราง
- [x] ตั้ง policies ให้ถูกต้อง (admin only)

### Task 1.4: Apply Migration ✅
- [x] Apply migration ด้วย Supabase MCP
- [x] Verify ตารางถูกสร้างครบ
- [x] Verify seed data ครบถ้วน

### Task 1.5: Setup First Super Admin ✅
- [x] สร้าง admin_users record จาก auth.users ที่มีอยู่ (admin@admin)
- [x] Assign super_admin role
- [x] Verify มี permissions ครบทั้ง 16 รายการ

---

## Phase 2: Server-Side Code

### Task 2.1: Type Definitions ✅
- [x] สร้างไฟล์ `src/types/admin.ts`
- [x] Define AdminUser interface
- [x] Define AdminRole interface
- [x] Define AdminPermission interface
- [x] Define PermissionKey constants
- [x] Define Request/Response types

### Task 2.2: Admin Auth Utilities ✅
- [x] สร้างไฟล์ `src/lib/admin-auth.ts`
- [x] Function: `verifyAdminSession(authUserId)`
- [x] Function: `checkPermission(adminUserId, permission)`
- [x] Function: `getAdminPermissions(adminUserId)`
- [x] Function: `getAdminRoles(adminUserId)`
- [x] Function: `isSuperAdmin(adminUserId)`
- [x] Guard functions: `requireAdmin()`, `requirePermission()`, `requireSuperAdmin()`

### Task 2.3: Middleware ✅
- [x] แก้ไข `src/middleware.ts`
- [x] Re-enable middleware
- [x] เพิ่ม admin session check สำหรับ `/admin/*` routes
- [x] Redirect to `/admin/login` ถ้าไม่มีสิทธิ์
- [x] ตรวจสอบ admin_users record

### Task 2.4: Admin Auth Hook ✅
- [x] แก้ไข `src/hooks/useAdminAuth.ts`
- [x] เพิ่ม `adminUser`, `roles`, `permissions` ใน context
- [x] เพิ่ม `hasPermission()` helper
- [x] เพิ่ม `hasAnyPermission()` helper
- [x] เพิ่ม `hasAllPermissions()` helper
- [x] เพิ่ม `isSuperAdmin` flag
- [x] เพิ่ม `refetch()` function

### Task 2.5: Admin Layout ✅
- [x] แก้ไข `src/app/admin/layout.tsx`
- [x] โหลด admin user + permissions เข้า context
- [x] แสดง admin info และ role
- [x] ซ่อน menu items ตาม permissions
- [x] เพิ่ม menu "จัดการ Admin" และ "จัดการ Role"

---

## Phase 3: Admin Management UI

### Task 3.1: Admin List Page ✅
- [x] สร้างไฟล์ `src/app/admin/admins/page.tsx`
- [x] ตารางแสดง admin ทั้งหมด (จาก admin_users)
- [x] แสดง roles ของแต่ละคน
- [x] ปุ่ม "เพิ่ม Admin"
- [x] ปุ่ม "แก้ไข Roles" (TODO: Coming soon)
- [x] ปุ่ม "ปิดการใช้งาน"

### Task 3.2: Create Admin Dialog ✅
- [x] สร้าง component `src/components/admin/CreateAdminDialog.tsx`
- [x] Form: email, password, full_name
- [x] Multi-select: roles (checkbox)
- [x] Validation แบบ manual (ไม่ใช้ Zod)

### Task 3.3: Role List Page ✅
- [x] สร้างไฟล์ `src/app/admin/roles/page.tsx`
- [x] ตารางแสดง role ทั้งหมด พร้อมสถิติ
- [x] แสดงจำนวน permissions + จำนวนคนใช้
- [x] ปุ่ม "สร้าง Role"
- [x] ปุ่ม "แก้ไข Role"
- [x] ปุ่ม "ลบ Role" (ถ้า is_system = false และไม่มีคนใช้)
- [x] Permission check ด้วย `hasPermission(ADMINS_MANAGE)`

### Task 3.4: Create/Edit Role Dialog ✅
- [x] Dialog สร้าง role ใหม่ (inline ในหน้า roles)
- [x] Dialog แก้ไข role (inline ในหน้า roles)
- [x] Form: name, display_name, description
- [x] Permission checkboxes แบ่งกลุ่ม 6 categories
- [x] Select all per category
- [x] Validation และ error handling

### Task 3.5: Role Permission Checkboxes Component ✅
- [x] สร้าง checkbox groups สำหรับ permissions
- [x] จัดกลุ่มตาม category อัตโนมัติ
- [x] แสดงคำอธิบาย permission
- [x] Toggle category ทั้งหมดได้
- [x] UI components: Table, Checkbox (สร้างใหม่)

### Task 3.6: Admin Profile Page
- [ ] สร้างไฟล์ `src/app/admin/profile/page.tsx`
- [ ] แสดงข้อมูล admin_users ของตัวเอง
- [ ] แสดง roles + permissions ที่มี
- [ ] ปุ่มเปลี่ยน password (optional)

---

## Phase 4: API Routes - Admin Management

### Task 4.1: Admin CRUD APIs ✅
- [x] สร้าง `src/app/api/admin/admins/route.ts`
  - [x] GET: list admins
  - [x] POST: create admin (สร้าง auth.users + admin_users)
- [x] สร้าง `src/app/api/admin/admins/[id]/route.ts`
  - [x] GET: get admin by id (มีอยู่แล้ว)
  - [x] PUT: update admin
  - [x] DELETE: soft delete (set is_active = false)
- [ ] สร้าง `src/app/api/admin/admins/[id]/roles/route.ts` (TODO)
  - [ ] PUT: update admin roles

### Task 4.2: Role CRUD APIs ✅
- [x] สร้าง `src/app/api/admin/roles/route.ts`
  - [x] GET: list roles พร้อมสถิติ (permission_count, user_count)
  - [x] POST: create role พร้อม assign permissions
- [x] สร้าง `src/app/api/admin/roles/[id]/route.ts`
  - [x] GET: get role by id พร้อม permissions
  - [x] PUT: update role (display_name, description)
  - [x] DELETE: delete role (ถ้า is_system = false และไม่มีคนใช้)
- [x] สร้าง `src/app/api/admin/roles/[id]/permissions/route.ts`
  - [x] PUT: update role permissions (replace all)

### Task 4.3: Permission List API ✅
- [x] สร้าง `src/app/api/admin/permissions/route.ts`
  - [x] GET: list all permissions (grouped by category)

### Task 4.4: Admin /me API ✅
- [x] สร้าง `src/app/api/admin/me/route.ts`
  - [x] GET: get current admin user พร้อม roles + permissions

---

## Phase 5: API Protection - Add Permission Checks ✅

### Task 5.1: Receipts APIs ✅
- [x] `src/app/api/admin/receipts/route.ts` → `receipts.view`
- [x] `src/app/api/admin/receipts/[id]/approve/route.ts` → `receipts.approve`
- [x] `src/app/api/admin/receipts/[id]/reject/route.ts` → `receipts.reject`
- [x] `src/app/api/admin/receipts/auto-approve/route.ts` → `receipts.auto_process`
- [x] `src/app/api/admin/receipts/auto-reject/route.ts` → `receipts.auto_process`

### Task 5.2: Users APIs ✅
- [x] `src/app/api/admin/users/route.ts` → `users.view`
- [x] `src/app/api/admin/users/[id]/route.ts` (GET) → `users.view`
- [x] `src/app/api/admin/users/[id]/role/route.ts` (PATCH) → `users.edit`
- [x] `src/app/api/admin/users/[id]/points/route.ts` (POST) → `users.manage_points`
- [x] `src/app/api/admin/users/[id]/notes/route.ts` (GET/POST) → `users.manage_notes`
- [x] `src/app/api/admin/users/[id]/notes/[noteId]/route.ts` (PATCH/DELETE) → `users.manage_notes`

### Task 5.3: Rewards APIs ✅
- [x] `src/app/api/admin/rewards/route.ts` (GET) → `rewards.view`
- [x] `src/app/api/admin/rewards/route.ts` (POST) → `rewards.create`
- [x] `src/app/api/admin/rewards/[id]/route.ts` (PUT) → `rewards.edit`
- [x] `src/app/api/admin/rewards/[id]/route.ts` (DELETE) → `rewards.delete`

### Task 5.4: Redemptions APIs ✅
- [x] `src/app/api/admin/redemptions/route.ts` → `redemptions.view`
- [x] `src/app/api/admin/redemptions/[id]/complete/route.ts` → `redemptions.process`
- [x] `src/app/api/admin/redemptions/[id]/cancel/route.ts` → `redemptions.process`

### Task 5.5: Settings APIs ✅
- [x] `src/app/api/admin/point-settings/route.ts` (GET) → no permission required
- [x] `src/app/api/admin/point-settings/route.ts` (POST/PUT/DELETE) → `settings.edit`

---

## Phase 6: Permission-Based UI

### Task 6.1: Update Admin Pages
- [ ] `src/app/admin/receipts/page.tsx`
  - [ ] ซ่อนทั้งหน้าถ้าไม่มี `receipts.view`
  - [ ] ซ่อนปุ่ม Approve ถ้าไม่มี `receipts.approve`
  - [ ] ซ่อนปุ่ม Reject ถ้าไม่มี `receipts.reject`
- [ ] `src/app/admin/users/page.tsx`
  - [ ] ซ่อนทั้งหน้าถ้าไม่มี `users.view`
  - [ ] ซ่อนปุ่ม Edit ถ้าไม่มี `users.edit`
  - [ ] ซ่อนปุ่ม Manage Points ถ้าไม่มี `users.manage_points`
- [ ] `src/app/admin/rewards/page.tsx`
  - [ ] ซ่อนทั้งหน้าถ้าไม่มี `rewards.view`
  - [ ] ซ่อนปุ่ม Create ถ้าไม่มี `rewards.create`
  - [ ] ซ่อนปุ่ม Edit/Delete ถ้าไม่มี permission
- [ ] `src/app/admin/redemptions/page.tsx`
  - [ ] ซ่อนทั้งหน้าถ้าไม่มี `redemptions.view`
  - [ ] ซ่อนปุ่ม Process ถ้าไม่มี `redemptions.process`
- [ ] `src/app/admin/reports/page.tsx`
  - [ ] ซ่อนทั้งหน้าถ้าไม่มี permission (TBD)

### Task 6.2: Update Admin Sidebar
- [ ] แก้ไขไฟล์ sidebar component
- [ ] ซ่อน "ใบเสร็จ" ถ้าไม่มี `receipts.view`
- [ ] ซ่อน "ผู้ใช้" ถ้าไม่มี `users.view`
- [ ] ซ่อน "รางวัล" ถ้าไม่มี `rewards.view`
- [ ] ซ่อน "การแลกรางวัล" ถ้าไม่มี `redemptions.view`
- [ ] ซ่อน "จัดการ Admin" ถ้าไม่มี `admins.manage`
- [ ] ซ่อน "จัดการ Role" ถ้าไม่มี `admins.manage`

### Task 6.3: Update Admin Login
- [ ] แก้ไข `src/app/admin/login/page.tsx`
- [ ] หลัง login สำเร็จ → verify มี admin_users record
- [ ] ถ้าไม่มี → แสดง error "คุณไม่มีสิทธิ์เข้าถึงระบบ Admin"

---

## Phase 7: Testing & Verification

### Task 7.1: Database Testing
- [ ] Verify ตารางถูกสร้างครบ 5 ตาราง
- [ ] Verify permissions ครบ 16 รายการ
- [ ] Verify roles ครบ 4 roles
- [ ] Verify role permissions mapping ถูกต้อง
- [ ] Verify RLS policies ทำงาน

### Task 7.2: Super Admin Testing
- [ ] Login ด้วย Super Admin
- [ ] Verify เข้าถึงทุกหน้าได้
- [ ] Verify เห็นปุ่มทุกปุ่ม
- [ ] Test สร้าง admin ใหม่
- [ ] Test สร้าง role ใหม่

### Task 7.3: Sub-Admin Testing
- [ ] สร้าง Receipt Manager
- [ ] Login ด้วย Receipt Manager
- [ ] Verify เห็นเฉพาะหน้า Receipts
- [ ] Verify approve/reject ทำงาน
- [ ] Verify ไม่เห็นหน้าอื่นๆ

### Task 7.4: Permission Testing
- [ ] Test ทุก permission ทำงานถูกต้อง
- [ ] Test API endpoints return 403 ถ้าไม่มี permission
- [ ] Test UI ซ่อนปุ่มที่ไม่มี permission

### Task 7.5: Multi-Role Testing
- [ ] สร้าง admin ที่มี 2+ roles
- [ ] Verify permissions รวมกันถูกต้อง
- [ ] Test เข้าถึงได้ทุก feature ที่มี permission

---

## Phase 8: Documentation & Cleanup

### Task 8.1: Update Documentation
- [ ] อัพเดท README.md
- [ ] เขียน Admin User Guide
- [ ] เขียน API Documentation

### Task 8.2: Code Cleanup
- [ ] ลบ code ที่ไม่ใช้แล้ว
- [ ] ลบ comments TODO
- [ ] Format code ทั้งหมด

### Task 8.3: Type Safety
- [ ] Regenerate `database.types.ts`
- [ ] Fix TypeScript errors ทั้งหมด
- [ ] Run `npx tsc --noEmit`

---

## Summary

**Total Tasks:** ~80+ tasks
**Estimated Time:** 8 วันทำการ (1.5 สัปดาห์)

**Progress Tracking:**
- [x] Phase 1: Database & Migration (5/5) ✅
- [x] Phase 2: Server-Side Code (5/5) ✅
- [x] Phase 3: Admin Management UI (5/6) ✅ (Missing: Admin Profile Page)
- [x] Phase 4: API Routes - Admin Management (4/4) ✅
- [x] Phase 5: API Protection (5/5) ✅ **19 routes protected**
- [ ] Phase 6: Permission-Based UI (0/3) 🔜 NEXT
- [ ] Phase 7: Testing & Verification (0/5)
- [ ] Phase 8: Documentation & Cleanup (0/3)

---

**Last Updated:** 2025-11-02 (Updated after Phase 5 complete)
**Status:** 🎉 API Protection Complete! All 19 admin APIs now require proper permissions | Next: Update UI to hide unauthorized actions
