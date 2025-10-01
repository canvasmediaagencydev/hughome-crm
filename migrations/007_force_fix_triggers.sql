-- Migration: Force fix all point balance triggers
-- Date: 2025-10-01
-- Description: Drop all existing triggers and functions with CASCADE, then recreate correctly

-- Drop all triggers first (to avoid dependency errors)
DROP TRIGGER IF EXISTS trigger_sync_points_balance ON public.point_transactions CASCADE;
DROP TRIGGER IF EXISTS trigger_update_user_points_balance ON public.point_transactions CASCADE;
DROP TRIGGER IF EXISTS trigger_update_points_balance ON public.point_transactions CASCADE;

-- Drop all functions with CASCADE
DROP FUNCTION IF EXISTS public.sync_user_points_balance() CASCADE;
DROP FUNCTION IF EXISTS public.update_user_points_balance() CASCADE;

-- Recreate function with correct logic
CREATE OR REPLACE FUNCTION public.sync_user_points_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    affected_user_id UUID;
    new_balance INTEGER;
BEGIN
    -- Get the user_id that was affected
    IF TG_OP = 'DELETE' THEN
        affected_user_id = OLD.user_id;
    ELSE
        affected_user_id = NEW.user_id;
    END IF;

    -- Calculate current balance from all transactions for this user
    SELECT COALESCE(
        SUM(CASE
            WHEN type = 'earned' THEN points      -- Add earned points
            WHEN type = 'spent' THEN -points      -- Deduct spent points (points stored as positive)
            WHEN type = 'refund' THEN points      -- Add refunded points
            WHEN type = 'expired' THEN -points    -- Deduct expired points
            ELSE 0
        END), 0
    )
    INTO new_balance
    FROM public.point_transactions
    WHERE user_id = affected_user_id;

    -- Update user profile with calculated balance
    UPDATE public.user_profiles
    SET
        points_balance = new_balance,
        updated_at = NOW()
    WHERE id = affected_user_id;

    -- For INSERT/UPDATE operations, also update the balance_after field
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        NEW.balance_after = new_balance;
        RETURN NEW;
    END IF;

    -- For DELETE operations
    RETURN OLD;
END;
$$;

-- Recreate trigger
CREATE TRIGGER trigger_sync_points_balance
    BEFORE INSERT OR UPDATE OR DELETE ON public.point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_points_balance();

-- Comment for documentation
COMMENT ON FUNCTION public.sync_user_points_balance() IS
'Automatically calculates and updates user points_balance based on all point_transactions.
Supports types: earned (+), spent (-), refund (+), expired (-).
Points should be stored as positive values - the function handles the sign based on type.';

-- Fix existing data: Convert negative points to positive for 'spent' type
UPDATE public.point_transactions
SET points = ABS(points)
WHERE type = 'spent' AND points < 0;

-- Recalculate all user balances based on corrected data
DO $$
DECLARE
    user_record RECORD;
    calculated_balance INTEGER;
BEGIN
    FOR user_record IN SELECT DISTINCT user_id FROM public.point_transactions
    LOOP
        SELECT COALESCE(
            SUM(CASE
                WHEN type = 'earned' THEN points
                WHEN type = 'spent' THEN -points
                WHEN type = 'refund' THEN points
                WHEN type = 'expired' THEN -points
                ELSE 0
            END), 0
        )
        INTO calculated_balance
        FROM public.point_transactions
        WHERE user_id = user_record.user_id;

        UPDATE public.user_profiles
        SET points_balance = calculated_balance, updated_at = NOW()
        WHERE id = user_record.user_id;
    END LOOP;
END $$;

-- Verify: Show all triggers on point_transactions table
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'point_transactions'
ORDER BY trigger_name;
