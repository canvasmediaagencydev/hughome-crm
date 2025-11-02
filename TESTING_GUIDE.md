# RBAC System Testing Guide

## 📊 Database Verification Results

### ✅ Phase 7.1: Database Testing - PASSED

**Tables Created:**
- ✅ `admin_users` - 5 users total (2 super admins, 3 test accounts)
- ✅ `admin_roles` - 4 roles
- ✅ `admin_permissions` - 16 permissions across 6 categories
- ✅ `admin_role_permissions` - 29 mappings
- ✅ `admin_user_roles` - 5 user-role assignments

**Permissions by Category:**
1. **receipts** (4): view, approve, reject, auto_process
2. **users** (4): view, edit, manage_points, manage_notes
3. **rewards** (4): view, create, edit, delete
4. **redemptions** (2): view, process
5. **settings** (1): edit
6. **admins** (1): manage

**Roles Configuration:**
1. **Super Admin** (System Role)
   - All 16 permissions
   - Cannot be deleted

2. **Receipt Manager**
   - receipts.view, approve, reject, auto_process
   - users.view

3. **Customer Support**
   - users.view, manage_notes
   - redemptions.view, process

4. **Reward Manager**
   - rewards.view, create, edit, delete

---

## 🧪 Test Accounts

### Production Admin
```
Email: admin@admin
Password: (your production password)
Role: Super Admin
Access: Full system access
```

### Test Account 1: Receipt Manager
```
Email: receipt@test.com
Password: test1234
Role: Receipt Manager
Expected Permissions:
  ✅ View Receipts page
  ✅ Approve/Reject receipts
  ✅ Auto-approve/reject receipts
  ✅ View Users page (read-only)
  ❌ Cannot edit users
  ❌ Cannot see Rewards page
  ❌ Cannot see Redemptions page
  ❌ Cannot see Admin Management pages
```

### Test Account 2: Customer Support
```
Email: support@test.com
Password: test1234
Role: Customer Support
Expected Permissions:
  ✅ View Users page
  ✅ Manage user notes
  ✅ View Redemptions page
  ✅ Process redemptions (approve/ship)
  ❌ Cannot manage points
  ❌ Cannot see Receipts page
  ❌ Cannot see Rewards page
  ❌ Cannot see Admin Management pages
```

### Test Account 3: Reward Manager
```
Email: reward@test.com
Password: test1234
Role: Reward Manager
Expected Permissions:
  ✅ View Rewards page
  ✅ Create new rewards
  ✅ Edit existing rewards
  ✅ Delete rewards
  ❌ Cannot see Receipts page
  ❌ Cannot see Users page
  ❌ Cannot see Redemptions page
  ❌ Cannot see Admin Management pages
```

---

## 🧪 Manual Testing Checklist

### Phase 7.2: Super Admin Testing

**Test with: admin@admin**

- [ ] Login successfully
- [ ] Dashboard shows all menu items (7 items):
  - [ ] Dashboard
  - [ ] ตรวจสอบใบเสร็จ (Receipts)
  - [ ] จัดการผู้ใช้ (Users)
  - [ ] จัดการรางวัล (Rewards)
  - [ ] คำขอแลกรางวัล (Redemptions)
  - [ ] รายงาน (Reports)
  - [ ] จัดการ Admin
  - [ ] จัดการ Role
- [ ] Can access all pages without error
- [ ] All action buttons visible
- [ ] Can create new admin users
- [ ] Can create new roles
- [ ] Can assign permissions to roles

---

### Phase 7.3: Receipt Manager Testing

**Test with: receipt@test.com / test1234**

#### ✅ Expected Behavior:
- [ ] Login successful
- [ ] Sidebar shows only:
  - [ ] Dashboard
  - [ ] ตรวจสอบใบเสร็จ (Receipts)
  - [ ] จัดการผู้ใช้ (Users)
  - [ ] รายงาน (Reports)
- [ ] Can access Receipts page
  - [ ] Can see "Auto Approve" and "Auto Reject" buttons
  - [ ] Can approve individual receipts
  - [ ] Can reject individual receipts
- [ ] Can access Users page
  - [ ] Can view user list
  - [ ] Can view user details
  - [ ] **Cannot** see "Edit Points" button
  - [ ] **Cannot** see "Edit Role" button

#### ❌ Expected Restrictions:
- [ ] Cannot access `/admin/rewards` (redirected or 403)
- [ ] Cannot access `/admin/redemptions` (redirected or 403)
- [ ] Cannot access `/admin/admins` (redirected or 403)
- [ ] Cannot access `/admin/roles` (redirected or 403)

#### 🔒 API Permission Testing:
Test these API calls should return **403 Forbidden**:

```bash
# Should FAIL (no rewards permissions)
curl -X GET 'http://localhost:3000/api/admin/rewards' \
  -H "Authorization: Bearer {receipt_manager_token}"

# Should FAIL (no redemptions permissions)
curl -X GET 'http://localhost:3000/api/admin/redemptions' \
  -H "Authorization: Bearer {receipt_manager_token}"

# Should FAIL (no users.manage_points permission)
curl -X POST 'http://localhost:3000/api/admin/users/{user_id}/points' \
  -H "Authorization: Bearer {receipt_manager_token}"

# Should SUCCESS (has receipts.view)
curl -X GET 'http://localhost:3000/api/admin/receipts' \
  -H "Authorization: Bearer {receipt_manager_token}"
```

---

### Phase 7.4: Customer Support Testing

**Test with: support@test.com / test1234**

#### ✅ Expected Behavior:
- [ ] Login successful
- [ ] Sidebar shows only:
  - [ ] Dashboard
  - [ ] จัดการผู้ใช้ (Users)
  - [ ] คำขอแลกรางวัล (Redemptions)
  - [ ] รายงาน (Reports)
- [ ] Can access Users page
  - [ ] Can view user list
  - [ ] Can view user details
  - [ ] Can add/edit user notes
  - [ ] **Cannot** see "Edit Points" button
  - [ ] **Cannot** see "Edit Role" button
- [ ] Can access Redemptions page
  - [ ] Can view redemption requests
  - [ ] Can approve/ship redemptions
  - [ ] Can cancel redemptions with notes

#### ❌ Expected Restrictions:
- [ ] Cannot access `/admin/receipts` (no sidebar menu)
- [ ] Cannot access `/admin/rewards` (no sidebar menu)
- [ ] Cannot access `/admin/admins` (no sidebar menu)
- [ ] Cannot access `/admin/roles` (no sidebar menu)

---

### Phase 7.5: Reward Manager Testing

**Test with: reward@test.com / test1234**

#### ✅ Expected Behavior:
- [ ] Login successful
- [ ] Sidebar shows only:
  - [ ] Dashboard
  - [ ] จัดการรางวัล (Rewards)
  - [ ] รายงาน (Reports)
- [ ] Can access Rewards page
  - [ ] Can see "Create Reward" button
  - [ ] Can create new rewards
  - [ ] Can edit existing rewards
  - [ ] Can delete rewards
  - [ ] Can toggle reward availability

#### ❌ Expected Restrictions:
- [ ] Cannot access `/admin/receipts` (no sidebar menu)
- [ ] Cannot access `/admin/users` (no sidebar menu)
- [ ] Cannot access `/admin/redemptions` (no sidebar menu)
- [ ] Cannot access `/admin/admins` (no sidebar menu)

---

## 🧪 Phase 7.6: Multi-Role Testing

### Create Multi-Role Admin

**Option 1: Via Admin UI (as Super Admin)**
1. Login as `admin@admin`
2. Go to Admin Management page
3. Create new admin:
   - Email: multi@test.com
   - Password: test1234
   - Assign multiple roles:
     - ✅ Receipt Manager
     - ✅ Customer Support
4. Save

**Option 2: Via Database**
```sql
-- This will be done manually if needed
```

### Test Multi-Role Permissions
**Test with: multi@test.com / test1234**

Expected behavior:
- [ ] Sidebar shows combined menu items:
  - [ ] Dashboard
  - [ ] ตรวจสอบใบเสร็จ (from Receipt Manager)
  - [ ] จัดการผู้ใช้ (from both roles)
  - [ ] คำขอแลกรางวัล (from Customer Support)
  - [ ] รายงาน
- [ ] Has combined permissions:
  - [ ] Can approve receipts (Receipt Manager)
  - [ ] Can manage user notes (Customer Support)
  - [ ] Can process redemptions (Customer Support)

---

## 🔒 Login Validation Testing

### Test Inactive Admin
1. As Super Admin, go to Admin Management
2. Disable an admin account (set `is_active = false`)
3. Try to login with that account
4. Expected: Error message "บัญชี Admin ของคุณถูกปิดการใช้งาน"

### Test Non-Admin User
1. Create a regular Supabase auth user (not in admin_users table)
2. Try to login to `/admin/login`
3. Expected: Error message "คุณไม่มีสิทธิ์เข้าถึงระบบ Admin"

---

## 📊 Testing Results Template

```
## Test Date: ____________________
## Tester: ____________________

### Database Verification
- [ ] All 5 RBAC tables exist
- [ ] 16 permissions seeded
- [ ] 4 roles seeded
- [ ] Role-permission mappings correct

### Super Admin Testing
- [ ] Full access confirmed
- [ ] Can create admins
- [ ] Can create roles

### Receipt Manager Testing
- [ ] Correct menu items shown
- [ ] Receipt operations work
- [ ] Restricted from other pages
- [ ] API returns 403 for unauthorized endpoints

### Customer Support Testing
- [ ] Correct menu items shown
- [ ] User operations work (except points/role)
- [ ] Redemption operations work
- [ ] Restricted from other pages

### Reward Manager Testing
- [ ] Correct menu items shown
- [ ] Reward CRUD operations work
- [ ] Restricted from other pages

### Multi-Role Testing
- [ ] Combined permissions work
- [ ] Combined sidebar menu items shown

### Login Validation
- [ ] Inactive admin blocked
- [ ] Non-admin user blocked
- [ ] Error messages clear and helpful

### Issues Found:
(List any bugs or unexpected behavior)

```

---

## 🛠 Cleanup Test Data

After testing, run this to remove test accounts:

```bash
node scripts/cleanup-test-admins.js
```

Or manually delete from Supabase:
```sql
-- Delete test admin users
DELETE FROM admin_user_roles
WHERE admin_user_id IN (
  SELECT id FROM admin_users WHERE email LIKE '%test.com'
);

DELETE FROM admin_users WHERE email LIKE '%test.com';

-- Delete auth users (via Supabase dashboard)
-- Go to Authentication > Users
-- Search for @test.com
-- Delete each user
```

---

## ✅ Success Criteria

Phase 7 is complete when:
- [x] Database has all required tables and data
- [x] Test admin accounts created successfully
- [ ] All test accounts can login
- [ ] Each role shows correct sidebar menu items
- [ ] Each role can access only permitted pages
- [ ] Each role sees only permitted action buttons
- [ ] API endpoints return 403 for unauthorized access
- [ ] Login validation blocks inactive/non-admin users
- [ ] Multi-role permissions combine correctly
- [ ] No errors in browser console
- [ ] No errors in server logs

---

**Generated:** 2025-11-02
**Last Updated:** Phase 7.2 complete - test accounts created
