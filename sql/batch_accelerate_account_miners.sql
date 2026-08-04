-- Batch accelerate all active purchased miners owned by the given addresses.
--
-- Usage:
--   SELECT * FROM batch_accelerate_account_miners(ARRAY['0x...', '0x...']);
--
-- Notes:
-- 1. Each active miner is accelerated to expected_reward.
-- 2. The balance log uses type = 'miner_reward', same as single miner acceleration.
-- 3. This function does not change reward_per_second, last_reward_at, cycle, or cycle_end_at.
-- 4. This function shares the distribute_miner_rewards advisory lock to avoid concurrent over-release.

CREATE OR REPLACE FUNCTION batch_accelerate_account_miners(
  p_addresses text[]
)
RETURNS TABLE (
  input_address_count integer,
  matched_account_count integer,
  accelerated_account_count integer,
  accelerated_miner_count integer,
  total_reward text
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_timestamp_sec integer;
BEGIN
  IF p_addresses IS NULL OR array_length(p_addresses, 1) IS NULL THEN
    RAISE EXCEPTION 'EMPTY_ADDRESS_LIST';
  END IF;

  DROP TABLE IF EXISTS pg_temp.tmp_batch_addresses;
  DROP TABLE IF EXISTS pg_temp.tmp_batch_accounts;
  DROP TABLE IF EXISTS pg_temp.tmp_batch_miners;
  DROP TABLE IF EXISTS pg_temp.tmp_batch_account_rewards;

  CREATE TEMP TABLE tmp_batch_addresses ON COMMIT DROP AS
  SELECT DISTINCT lower(trim(input_address.address)) AS address
  FROM unnest(p_addresses) AS input_address(address)
  WHERE trim(input_address.address) <> '';

  SELECT COUNT(*)
  INTO input_address_count
  FROM tmp_batch_addresses;

  IF input_address_count <= 0 THEN
    RAISE EXCEPTION 'EMPTY_ADDRESS_LIST';
  END IF;

  -- Serialize with normal miner reward distribution and single miner acceleration.
  IF NOT pg_try_advisory_xact_lock(hashtext('distribute_miner_rewards')) THEN
    RAISE EXCEPTION 'DISTRIBUTE_MINER_REWARDS_ALREADY_RUNNING';
  END IF;

  current_timestamp_sec := EXTRACT(EPOCH FROM NOW())::integer;

  -- Lock matched accounts first, then snapshot balances for correct balance logs.
  PERFORM a.id
  FROM account a
  JOIN tmp_batch_addresses input
    ON lower(a.address) = input.address
  ORDER BY a.id
  FOR UPDATE;

  CREATE TEMP TABLE tmp_batch_accounts ON COMMIT DROP AS
  SELECT a.id, a.address, a.balance
  FROM account a
  JOIN tmp_batch_addresses input
    ON lower(a.address) = input.address;

  SELECT COUNT(*)
  INTO matched_account_count
  FROM tmp_batch_accounts;

  -- Lock active miners before calculating remaining rewards.
  PERFORM am.id
  FROM account_miner am
  JOIN tmp_batch_accounts a
    ON a.id = am.account_id
  WHERE am.produced_reward < am.expected_reward
  ORDER BY am.account_id, am.id
  FOR UPDATE;

  CREATE TEMP TABLE tmp_batch_miners ON COMMIT DROP AS
  SELECT
    am.id AS account_miner_id,
    am.account_id,
    am.expected_reward - am.produced_reward AS reward
  FROM account_miner am
  JOIN tmp_batch_accounts a
    ON a.id = am.account_id
  WHERE am.produced_reward < am.expected_reward;

  SELECT
    COUNT(*),
    COALESCE(SUM(reward), 0)::text
  INTO accelerated_miner_count, total_reward
  FROM tmp_batch_miners
  WHERE reward > 0;

  CREATE TEMP TABLE tmp_batch_account_rewards ON COMMIT DROP AS
  SELECT
    account_id,
    SUM(reward) AS reward
  FROM tmp_batch_miners
  WHERE reward > 0
  GROUP BY account_id;

  SELECT COUNT(*)
  INTO accelerated_account_count
  FROM tmp_batch_account_rewards;

  IF accelerated_miner_count > 0 THEN
    INSERT INTO account_balance_log (
      account_id,
      type,
      token,
      amount,
      balance_before,
      balance_after,
      created_at
    )
    SELECT
      a.id,
      'miner_reward',
      'SPACE',
      r.reward,
      a.balance,
      a.balance + r.reward,
      current_timestamp_sec
    FROM tmp_batch_accounts a
    JOIN tmp_batch_account_rewards r
      ON r.account_id = a.id
    WHERE r.reward > 0;

    UPDATE account a
    SET balance = a.balance + r.reward
    FROM tmp_batch_account_rewards r
    WHERE a.id = r.account_id
      AND r.reward > 0;

    UPDATE account_miner am
    SET produced_reward = am.expected_reward
    FROM tmp_batch_miners m
    WHERE am.id = m.account_miner_id
      AND m.reward > 0;
  END IF;

  RETURN NEXT;
END;
$$;
