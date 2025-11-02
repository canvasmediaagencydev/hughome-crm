ALTER TABLE user_notes
ADD COLUMN created_by_admin_id uuid REFERENCES admin_users(id);
