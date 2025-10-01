-- Migration: Fix point balance trigger to support refund type and correct spent calculation
-- Date: 2025-10-01
-- Description:
--   1. Add support for 'refund' type in CASE WHEN
--   2. Ensure 'spent' type points are stored as positive values and negated by trigger
--   3. Remove manual points_balance updates - let trigger handle all balance calculations

-- Drop all existing triggers and functions (old and new versions)
DROP TRIGGER IF EXISTS trigger_sync_points_balance ON public.point_transactions;
DROP TRIGGER IF EXISTS trigger_update_user_points_balance ON public.point_transactions;
DROP FUNCTION IF EXISTS public.sync_user_points_balance();
DROP FUNCTION IF EXISTS public.update_user_points_balance();

-- Recreate function with refund support
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
-- This ensures consistency with the new trigger logic
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
