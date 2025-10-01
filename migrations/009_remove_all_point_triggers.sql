-- Migration: Remove all point balance triggers and functions
-- Date: 2025-10-01
-- Description: Move point balance calculation from database triggers to application code

-- Drop all triggers related to point transactions
DROP TRIGGER IF EXISTS trigger_sync_points_balance ON public.point_transactions CASCADE;
DROP TRIGGER IF EXISTS trigger_set_balance_after ON public.point_transactions CASCADE;
DROP TRIGGER IF EXISTS trigger_update_user_points_balance ON public.point_transactions CASCADE;
DROP TRIGGER IF EXISTS trigger_update_points_balance ON public.point_transactions CASCADE;

-- Drop all functions related to point balance calculation
DROP FUNCTION IF EXISTS public.sync_user_points_balance() CASCADE;
DROP FUNCTION IF EXISTS public.set_balance_after() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_points_balance() CASCADE;

-- Verify: Show remaining triggers (should be empty)
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'point_transactions'
ORDER BY trigger_name;

-- Add comment to remind developers that points are managed in application code
COMMENT ON TABLE public.point_transactions IS
'Point transactions log. Note: points_balance in user_profiles is managed by application code, not database triggers.';

COMMENT ON COLUMN public.user_profiles.points_balance IS
'Current points balance. Updated manually by application code when transactions occur.';
