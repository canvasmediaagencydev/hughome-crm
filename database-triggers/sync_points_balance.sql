-- Function to automatically sync user points_balance when point_transactions are modified
CREATE OR REPLACE FUNCTION sync_user_points_balance()
RETURNS TRIGGER AS $$
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
            WHEN type = 'earned' THEN points
            WHEN type = 'spent' THEN -points
            WHEN type = 'expired' THEN -points
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
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_points_balance ON public.point_transactions;

-- Create trigger that fires AFTER INSERT, UPDATE, or DELETE on point_transactions
CREATE TRIGGER trigger_sync_points_balance
    AFTER INSERT OR UPDATE OR DELETE
    ON public.point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_points_balance();

-- Also create a BEFORE INSERT/UPDATE trigger to set balance_after correctly
CREATE OR REPLACE FUNCTION set_balance_after()
RETURNS TRIGGER AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    -- Calculate current balance before this transaction
    SELECT COALESCE(
        SUM(CASE
            WHEN type = 'earned' THEN points
            WHEN type = 'spent' THEN -points
            WHEN type = 'expired' THEN -points
            ELSE 0
        END), 0
    )
    INTO current_balance
    FROM public.point_transactions
    WHERE user_id = NEW.user_id;

    -- Set balance_after to what it will be after this transaction
    IF NEW.type = 'earned' THEN
        NEW.balance_after = current_balance + NEW.points;
    ELSE
        NEW.balance_after = current_balance - NEW.points;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_balance_after ON public.point_transactions;

-- Create BEFORE trigger to set balance_after
CREATE TRIGGER trigger_set_balance_after
    BEFORE INSERT OR UPDATE
    ON public.point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION set_balance_after();

-- Manually sync all existing users (one-time operation)
UPDATE public.user_profiles
SET points_balance = (
    SELECT COALESCE(
        SUM(CASE
            WHEN pt.type = 'earned' THEN pt.points
            WHEN pt.type = 'spent' THEN -pt.points
            WHEN pt.type = 'expired' THEN -pt.points
            ELSE 0
        END), 0
    )
    FROM public.point_transactions pt
    WHERE pt.user_id = user_profiles.id
),
updated_at = NOW();