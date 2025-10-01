-- Migration: Remove duplicate trigger set_balance_after
-- Date: 2025-10-01
-- Description: Remove redundant trigger that conflicts with sync_user_points_balance

-- Drop the duplicate trigger and its function
DROP TRIGGER IF EXISTS trigger_set_balance_after ON public.point_transactions CASCADE;
DROP FUNCTION IF EXISTS public.set_balance_after() CASCADE;

-- Verify: Show remaining triggers (should only have trigger_sync_points_balance)
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'point_transactions'
ORDER BY trigger_name;
