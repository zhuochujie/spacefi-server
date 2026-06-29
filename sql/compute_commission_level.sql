CREATE OR REPLACE FUNCTION compute_commission_level(p_account_id integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  total_direct_miner_count integer;
  mid_direct_miner_count integer;
  high_direct_miner_count integer;
  mid_miner_price_threshold numeric;
  high_miner_price_threshold numeric;
BEGIN
  SELECT
    MAX(value::numeric) FILTER (
      WHERE key = 'COMMISSION_MID_MINER_PRICE_WEI'
    ),
    MAX(value::numeric) FILTER (
      WHERE key = 'COMMISSION_HIGH_MINER_PRICE_WEI'
    )
  INTO mid_miner_price_threshold, high_miner_price_threshold
  FROM config
  WHERE key IN (
    'COMMISSION_MID_MINER_PRICE_WEI',
    'COMMISSION_HIGH_MINER_PRICE_WEI'
  );

  IF mid_miner_price_threshold IS NULL THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: COMMISSION_MID_MINER_PRICE_WEI';
  END IF;

  IF high_miner_price_threshold IS NULL THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: COMMISSION_HIGH_MINER_PRICE_WEI';
  END IF;

  IF mid_miner_price_threshold >= high_miner_price_threshold THEN
    RAISE EXCEPTION 'INVALID_COMMISSION_PRICE_THRESHOLDS';
  END IF;

  -- 按直推用户去重统计。每名直推无论拥有多少不同类型矿机，最多计一次。
  SELECT
    COUNT(DISTINCT ar.subordinate_id),
    COUNT(DISTINCT ar.subordinate_id) FILTER (
      WHERE m.price >= mid_miner_price_threshold
    ),
    COUNT(DISTINCT ar.subordinate_id) FILTER (
      WHERE m.price >= high_miner_price_threshold
    )
  INTO
    total_direct_miner_count,
    mid_direct_miner_count,
    high_direct_miner_count
  FROM account_relation ar
  JOIN account_miner am ON am.account_id = ar.subordinate_id
  JOIN miner m ON m.id = am.miner_id
  WHERE ar.superior_id = p_account_id
    AND ar.level = 1;

  IF high_direct_miner_count >= 3 THEN
    RETURN 20;
  ELSIF high_direct_miner_count >= 2 THEN
    RETURN 15;
  ELSIF high_direct_miner_count >= 1 THEN
    RETURN 10;
  ELSIF mid_direct_miner_count >= 1 THEN
    RETURN 5;
  ELSIF total_direct_miner_count >= 1 THEN
    RETURN 1;
  ELSE
    RETURN 0;
  END IF;
END;
$$;
