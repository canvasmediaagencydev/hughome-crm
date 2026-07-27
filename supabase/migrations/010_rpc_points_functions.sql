-- 010_rpc_points_functions.sql — MIGRATION_PLAN.md §4.4
-- All money/points mutations go through these RPCs. Every function locks the
-- affected user_profiles row(s) FOR UPDATE before computing, is SECURITY
-- DEFINER, sets a fixed search_path, and is revoked from anon/authenticated
-- (only service_role — used by the server — may execute).
--
-- Invariant kept everywhere: user_profiles.points_balance == SUM(point_batch_ledger.points_remaining)
--
-- Helper convention:
--   earned_month = 1st of the current month in Asia/Bangkok
--   expires_at   = (last day of earned_month) + 365 days   (§4.2)

-- ===========================================================================
-- award_points_from_batch(p_batch_id) → integer (total points awarded)
-- ---------------------------------------------------------------------------
-- raw_rows CONTRACT (produced by the Sprint 4 parser, stored at preview):
--   raw_rows is a JSON array; VALID+matched rows are objects with:
--     { "status":"valid", "user_id":<uuid>, "points":<int>0>,
--       "gross":<num>, "discount":<num>, "net":<num>,
--       "promo_code_id":<uuid|null>, "multiplier":<num> }
--   Rows without status='valid' (invalid/unmatched) are ignored here.
-- ===========================================================================
CREATE OR REPLACE FUNCTION award_points_from_batch(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch        point_batches%ROWTYPE;
  v_earned_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date;
  v_expires_at   date := ((date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date + interval '1 month')::date - 1) + 365;
  v_row          jsonb;
  v_user_id      uuid;
  v_points       integer;
  v_promo        uuid;
  v_new_balance  integer;
  v_total        integer := 0;
BEGIN
  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'previewed' THEN
    RAISE EXCEPTION 'batch % is % (must be previewed to commit)', p_batch_id, v_batch.status;
  END IF;

  FOR v_row IN
    SELECT e FROM jsonb_array_elements(v_batch.raw_rows) e
    WHERE e->>'status' = 'valid'
    ORDER BY e->>'user_id'          -- deterministic lock order → avoid deadlocks
  LOOP
    v_user_id := (v_row->>'user_id')::uuid;
    v_points  := (v_row->>'points')::integer;
    v_promo   := NULLIF(v_row->>'promo_code_id', '')::uuid;
    IF v_points IS NULL OR v_points <= 0 THEN
      RAISE EXCEPTION 'invalid points for user % in batch %', v_user_id, p_batch_id;
    END IF;

    -- Lock the user before touching balance.
    PERFORM 1 FROM user_profiles WHERE id = v_user_id FOR UPDATE;

    INSERT INTO point_batch_ledger (
      user_id, source_batch_id, source, points_earned, points_remaining,
      earned_month, expires_at, gross_amount, discount_amount, net_amount,
      promo_code_id, multiplier
    ) VALUES (
      v_user_id, p_batch_id, 'batch', v_points, v_points,
      v_earned_month, v_expires_at,
      (v_row->>'gross')::numeric, (v_row->>'discount')::numeric, (v_row->>'net')::numeric,
      v_promo, COALESCE((v_row->>'multiplier')::numeric, 1)
    );

    UPDATE user_profiles
      SET points_balance = points_balance + v_points, updated_at = now()
      WHERE id = v_user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, description)
    VALUES (v_user_id, 'earned', v_points, v_new_balance, 'batch', p_batch_id, 'Batch award');

    IF v_promo IS NOT NULL THEN
      UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = v_promo;
    END IF;

    v_total := v_total + v_points;
  END LOOP;

  UPDATE point_batches
    SET status = 'committed', committed_at = now(), total_points = v_total
    WHERE id = p_batch_id;

  RETURN v_total;
END;
$$;

-- ===========================================================================
-- void_batch(p_batch_id, p_admin, p_reason) → void
-- Reverses the still-remaining points of a committed batch (safe: never drives
-- a balance negative). Points a customer already spent are not clawed back.
-- ===========================================================================
CREATE OR REPLACE FUNCTION void_batch(p_batch_id uuid, p_admin uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch       point_batches%ROWTYPE;
  v_lot         point_batch_ledger%ROWTYPE;
  v_new_balance integer;
BEGIN
  SELECT * INTO v_batch FROM point_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'batch % not found', p_batch_id; END IF;
  IF v_batch.status <> 'committed' THEN
    RAISE EXCEPTION 'batch % is % (only committed can be voided)', p_batch_id, v_batch.status;
  END IF;

  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE source_batch_id = p_batch_id AND points_remaining > 0
    ORDER BY user_id
  LOOP
    PERFORM 1 FROM user_profiles WHERE id = v_lot.user_id FOR UPDATE;

    UPDATE point_batch_ledger SET points_remaining = 0 WHERE id = v_lot.id;

    UPDATE user_profiles
      SET points_balance = points_balance - v_lot.points_remaining, updated_at = now()
      WHERE id = v_lot.user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, created_by, description)
    VALUES (v_lot.user_id, 'refund', -v_lot.points_remaining, v_new_balance, 'batch', p_batch_id, p_admin, 'Batch voided: ' || COALESCE(p_reason, ''));

    IF v_lot.promo_code_id IS NOT NULL THEN
      UPDATE promo_codes SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = v_lot.promo_code_id;
    END IF;
  END LOOP;

  UPDATE point_batches
    SET status = 'voided', voided_by = p_admin, voided_at = now(), void_reason = p_reason
    WHERE id = p_batch_id;
END;
$$;

-- ===========================================================================
-- redeem_reward(p_user, p_reward, p_qty) → uuid (redemption id)
-- Locks user, checks stock + balance, deducts FIFO from active lots.
-- ===========================================================================
CREATE OR REPLACE FUNCTION redeem_reward(p_user uuid, p_reward uuid, p_qty integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reward       rewards%ROWTYPE;
  v_cost         integer;
  v_balance      integer;
  v_remaining    integer;
  v_take         integer;
  v_lot          point_batch_ledger%ROWTYPE;
  v_redemption   uuid;
  v_new_balance  integer;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;

  -- Lock the user first, then read the reward.
  SELECT points_balance INTO v_balance FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user % not found', p_user; END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reward % not found', p_reward; END IF;
  IF NOT v_reward.is_active OR v_reward.is_archived THEN
    RAISE EXCEPTION 'reward % is not available', p_reward;
  END IF;
  IF v_reward.stock_quantity IS NOT NULL AND v_reward.stock_quantity < p_qty THEN
    RAISE EXCEPTION 'reward % out of stock', p_reward;
  END IF;

  v_cost := v_reward.points_cost * p_qty;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'insufficient points: have %, need %', v_balance, v_cost;
  END IF;

  -- FIFO deduction: soonest-expiring active lots first.
  v_remaining := v_cost;
  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE user_id = p_user AND points_remaining > 0 AND expires_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date
    ORDER BY expires_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_lot.points_remaining, v_remaining);
    UPDATE point_batch_ledger SET points_remaining = points_remaining - v_take WHERE id = v_lot.id;
    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    -- Balance said enough but active lots didn't cover it → invariant broken.
    RAISE EXCEPTION 'ledger/balance mismatch for user % (short by %)', p_user, v_remaining;
  END IF;

  UPDATE user_profiles
    SET points_balance = points_balance - v_cost, updated_at = now()
    WHERE id = p_user
    RETURNING points_balance INTO v_new_balance;

  IF v_reward.stock_quantity IS NOT NULL THEN
    UPDATE rewards SET stock_quantity = stock_quantity - p_qty, updated_at = now() WHERE id = p_reward;
  END IF;

  INSERT INTO redemptions (user_id, reward_id, points_used, quantity, status)
  VALUES (p_user, p_reward, v_cost, p_qty, 'requested')
  RETURNING id INTO v_redemption;

  INSERT INTO point_transactions (user_id, type, points, balance_after, source, description)
  VALUES (p_user, 'spent', -v_cost, v_new_balance, 'redemption', 'Redeem: ' || v_reward.name);

  RETURN v_redemption;
END;
$$;

-- ===========================================================================
-- expire_ledger_batches(p_as_of) → integer (points expired)
-- Zeros every lot whose expires_at < p_as_of and adjusts balances. Lots are
-- kept (points_remaining=0) as history — never deleted (§7 rule).
-- ===========================================================================
CREATE OR REPLACE FUNCTION expire_ledger_batches(p_as_of date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lot         point_batch_ledger%ROWTYPE;
  v_new_balance integer;
  v_total       integer := 0;
BEGIN
  FOR v_lot IN
    SELECT * FROM point_batch_ledger
    WHERE points_remaining > 0 AND expires_at < p_as_of
    ORDER BY user_id
  LOOP
    PERFORM 1 FROM user_profiles WHERE id = v_lot.user_id FOR UPDATE;

    UPDATE point_batch_ledger SET points_remaining = 0 WHERE id = v_lot.id;

    UPDATE user_profiles
      SET points_balance = points_balance - v_lot.points_remaining, updated_at = now()
      WHERE id = v_lot.user_id
      RETURNING points_balance INTO v_new_balance;

    INSERT INTO point_transactions (user_id, type, points, balance_after, source, source_batch_id, description)
    VALUES (v_lot.user_id, 'expired', -v_lot.points_remaining, v_new_balance, 'expiry', v_lot.source_batch_id, 'Points expired');

    v_total := v_total + v_lot.points_remaining;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ===========================================================================
-- adjust_points_manual(p_user, p_delta, p_admin, p_note) → integer (new balance)
-- +delta creates a manual lot; −delta deducts FIFO. Keeps the ledger invariant.
-- ===========================================================================
CREATE OR REPLACE FUNCTION adjust_points_manual(p_user uuid, p_delta integer, p_admin uuid, p_note text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance      integer;
  v_earned_month date := date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date;
  v_expires_at   date := ((date_trunc('month', (now() AT TIME ZONE 'Asia/Bangkok'))::date + interval '1 month')::date - 1) + 365;
  v_remaining    integer;
  v_take         integer;
  v_lot          point_batch_ledger%ROWTYPE;
  v_new_balance  integer;
BEGIN
  IF p_delta = 0 THEN RAISE EXCEPTION 'delta must be non-zero'; END IF;

  SELECT points_balance INTO v_balance FROM user_profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'user % not found', p_user; END IF;

  IF v_balance + p_delta < 0 THEN
    RAISE EXCEPTION 'adjustment would make balance negative (have %, delta %)', v_balance, p_delta;
  END IF;

  IF p_delta > 0 THEN
    INSERT INTO point_batch_ledger (user_id, source_batch_id, source, points_earned, points_remaining, earned_month, expires_at, multiplier)
    VALUES (p_user, NULL, 'manual', p_delta, p_delta, v_earned_month, v_expires_at, 1);
  ELSE
    v_remaining := -p_delta;
    FOR v_lot IN
      SELECT * FROM point_batch_ledger
      WHERE user_id = p_user AND points_remaining > 0 AND expires_at >= (now() AT TIME ZONE 'Asia/Bangkok')::date
      ORDER BY expires_at ASC, created_at ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_lot.points_remaining, v_remaining);
      UPDATE point_batch_ledger SET points_remaining = points_remaining - v_take WHERE id = v_lot.id;
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'ledger/balance mismatch for user % (short by %)', p_user, v_remaining;
    END IF;
  END IF;

  UPDATE user_profiles
    SET points_balance = points_balance + p_delta, updated_at = now()
    WHERE id = p_user
    RETURNING points_balance INTO v_new_balance;

  INSERT INTO point_transactions (user_id, type, points, balance_after, source, created_by, description)
  VALUES (p_user, (CASE WHEN p_delta > 0 THEN 'bonus' ELSE 'spent' END)::transaction_type, p_delta, v_new_balance, 'manual', p_admin, p_note);

  RETURN v_new_balance;
END;
$$;

-- --- Lock down execution: server (service_role) only ------------------------
REVOKE ALL ON FUNCTION award_points_from_batch(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION void_batch(uuid, uuid, text)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION redeem_reward(uuid, uuid, integer)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION expire_ledger_batches(date)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION adjust_points_manual(uuid, integer, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION award_points_from_batch(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION void_batch(uuid, uuid, text)            TO service_role;
GRANT EXECUTE ON FUNCTION redeem_reward(uuid, uuid, integer)      TO service_role;
GRANT EXECUTE ON FUNCTION expire_ledger_batches(date)            TO service_role;
GRANT EXECUTE ON FUNCTION adjust_points_manual(uuid, integer, uuid, text) TO service_role;
