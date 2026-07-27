-- rollback 012_seed_permissions_roles.sql
-- Removes the seeded system roles/permissions (and their mappings via cascade).
DELETE FROM admin_roles WHERE name IN
  ('super_admin', 'manager', 'accounting', 'sales_staff', 'reward_manager', 'customer_support');

DELETE FROM admin_permissions WHERE permission_key IN (
  'dashboard.view',
  'users.view', 'users.edit', 'users.manage_points', 'users.manage_notes', 'users.manage_tags',
  'tags.view', 'tags.manage',
  'rewards.view', 'rewards.create', 'rewards.edit', 'rewards.delete',
  'redemptions.view', 'redemptions.process', 'redemptions.deliver',
  'batches.view', 'batches.upload', 'batches.commit', 'batches.review', 'batches.void',
  'promos.view', 'promos.manage',
  'notifications.manage', 'reports.view', 'settings.edit', 'admins.manage', 'sales.entry'
);
