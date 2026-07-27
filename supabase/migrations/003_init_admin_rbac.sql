-- 003_init_admin_rbac.sql — MIGRATION_PLAN.md §4.1, §7
-- Admin RBAC, fully separate from LINE users. Also wires the admin-actor FKs
-- for columns created in 002 (point_transactions.created_by, tags.created_by,
-- user_tags.assigned_by, user_notes.created_by_admin_id) now that admin_users
-- exists. These ADD CONSTRAINTs are FK wiring forced by the file order
-- (core 002 before admin 003), not data migration.

CREATE TABLE admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid UNIQUE NOT NULL,          -- Supabase auth.users id
  email         text UNIQUE NOT NULL,
  full_name     text,
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text UNIQUE NOT NULL,           -- 'super_admin', 'manager', ...
  display_name text NOT NULL,
  description  text,
  is_system    boolean NOT NULL DEFAULT false, -- system roles can't be deleted via UI
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text UNIQUE NOT NULL,         -- 'batches.commit', ...
  category     text NOT NULL,
  display_name text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_role_permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,        -- drop mappings with the role
  permission_id uuid NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,  -- drop mappings with the permission
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE admin_user_roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,  -- drop role links with the admin
  role_id       uuid NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,  -- drop links when the role is removed
  assigned_by   uuid REFERENCES admin_users(id) ON DELETE SET NULL,          -- keep the assignment, forget who assigned
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, role_id)
);

-- --- Wire admin-actor FKs for 002 columns (ON DELETE SET NULL: keep the row,
-- --- drop the actor link when the admin is deleted) ------------------------
ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE tags
  ADD CONSTRAINT tags_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE user_tags
  ADD CONSTRAINT user_tags_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE user_notes
  ADD CONSTRAINT user_notes_created_by_admin_id_fkey
  FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;
