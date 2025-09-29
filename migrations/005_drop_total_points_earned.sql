-- Migration: Drop total_points_earned column from user_profiles table
-- This simplifies the points system to use only points_balance
-- Created: 2025-01-XX

-- First drop the view that depends on total_points_earned
DROP VIEW IF EXISTS user_dashboard;

-- Then drop the total_points_earned column from user_profiles table
ALTER TABLE user_profiles
DROP COLUMN IF EXISTS total_points_earned;

CREATE VIEW user_dashboard AS
SELECT
  up.id,
  up.created_at,
  up.display_name,
  up.line_user_id,
  up.picture_url,
  up.last_login_at,
  up.role,
  up.points_balance,
  up.total_receipts,
  -- Calculate pending receipts
  COALESCE(pending_receipts.count, 0) AS pending_receipts,
  -- Calculate pending redemptions (placeholder for future)
  0 AS pending_redemptions
FROM user_profiles up
LEFT JOIN (
  SELECT
    user_id,
    COUNT(*) AS count
  FROM receipts
  WHERE status = 'pending'
  GROUP BY user_id
) pending_receipts ON up.id = pending_receipts.user_id;

-- Add comments for future reference
COMMENT ON VIEW user_dashboard IS 'Simplified user dashboard view without total_points_earned - using points_balance only';
COMMENT ON COLUMN user_profiles.points_balance IS 'User''s current points balance - the only points field needed';