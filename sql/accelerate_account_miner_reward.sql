-- Immediately release SPACE reward for one purchased miner.
--
-- Usage:
--   CALL accelerate_account_miner_reward(123, 1000000000000000000);
--
-- p_account_miner_id: account_miner.id
-- p_release_amount: SPACE wei amount to release immediately.
--
-- Notes:
-- 1. The actual released amount is capped by expected_reward - produced_reward.
-- 2. This procedure does not change reward_per_second.
-- 3. This procedure does not change last_reward_at, so time-based pending reward is not lost.
-- 4. The balance log uses type = 'miner_reward' because account_balance_log has no separate acceleration type.

CREATE OR REPLACE PROCEDURE accelerate_account_miner_reward(
  p_account_miner_id integer,
  p_release_amount numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_timestamp_sec integer;
  target_account_id integer;
  target_expected_reward numeric;
  target_produced_reward numeric;
  target_balance numeric;
  remaining_reward numeric;
  actual_reward numeric;
BEGIN
  IF p_account_miner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACCOUNT_MINER_ID';
  END IF;

  IF p_release_amount IS NULL
    OR p_release_amount <= 0
    OR p_release_amount <> FLOOR(p_release_amount) THEN
    RAISE EXCEPTION 'INVALID_RELEASE_AMOUNT';
  END IF;

  -- Serialize with the normal account_miner reward distribution procedure.
  -- Otherwise distribute_miner_rewards may calculate reward from an old
  -- produced_reward snapshot and then over-add after this procedure updates it.
  IF NOT pg_try_advisory_xact_lock(hashtext('distribute_miner_rewards')) THEN
    RAISE EXCEPTION 'DISTRIBUTE_MINER_REWARDS_ALREADY_RUNNING';
  END IF;

  current_timestamp_sec := EXTRACT(EPOCH FROM NOW())::integer;

  SELECT
    am.account_id,
    am.expected_reward,
    am.produced_reward,
    a.balance
  INTO
    target_account_id,
    target_expected_reward,
    target_produced_reward,
    target_balance
  FROM account_miner am
  JOIN account a
    ON a.id = am.account_id
  WHERE am.id = p_account_miner_id
  FOR UPDATE OF am, a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_MINER_NOT_FOUND: %', p_account_miner_id;
  END IF;

  remaining_reward := target_expected_reward - target_produced_reward;

  IF remaining_reward <= 0 THEN
    RAISE EXCEPTION 'ACCOUNT_MINER_REWARD_ALREADY_COMPLETED: %', p_account_miner_id;
  END IF;

  actual_reward := LEAST(p_release_amount, remaining_reward);

  INSERT INTO account_balance_log (
    account_id,
    type,
    token,
    amount,
    balance_before,
    balance_after,
    created_at
  )
  VALUES (
    target_account_id,
    'miner_reward',
    'SPACE',
    actual_reward,
    target_balance,
    target_balance + actual_reward,
    current_timestamp_sec
  );

  UPDATE account
  SET balance = balance + actual_reward
  WHERE id = target_account_id;

  UPDATE account_miner
  SET produced_reward = produced_reward + actual_reward
  WHERE id = p_account_miner_id;

  RAISE NOTICE '矿机加速完成，account_miner_id: %, account_id: %, requested_reward: %, actual_reward: %, remaining_before: %, remaining_after: %',
    p_account_miner_id,
    target_account_id,
    p_release_amount,
    actual_reward,
    remaining_reward,
    remaining_reward - actual_reward;
END;
$$;
