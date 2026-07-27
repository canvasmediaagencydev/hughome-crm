-- rollback 003_init_admin_rbac.sql
ALTER TABLE user_notes         DROP CONSTRAINT IF EXISTS user_notes_created_by_admin_id_fkey;
ALTER TABLE user_tags          DROP CONSTRAINT IF EXISTS user_tags_assigned_by_fkey;
ALTER TABLE tags               DROP CONSTRAINT IF EXISTS tags_created_by_fkey;
ALTER TABLE point_transactions DROP CONSTRAINT IF EXISTS point_transactions_created_by_fkey;

DROP TABLE IF EXISTS admin_user_roles;
DROP TABLE IF EXISTS admin_role_permissions;
DROP TABLE IF EXISTS admin_permissions;
DROP TABLE IF EXISTS admin_roles;
DROP TABLE IF EXISTS admin_users;
