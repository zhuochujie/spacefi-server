CREATE OR REPLACE FUNCTION compute_commission_level(p_account_id integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  total_direct_miner_count integer;
  high_direct_miner_count integer;
  high_miner_price_threshold numeric;
BEGIN
  SELECT value::numeric
  INTO high_miner_price_threshold
  FROM config
  WHERE key = 'COMMISSION_HIGH_MINER_PRICE_WEI';

  IF high_miner_price_threshold IS NULL THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: COMMISSION_HIGH_MINER_PRICE_WEI';
  END IF;

  -- 直推用户拥有的所有矿机数量
  SELECT COUNT(*)
  INTO total_direct_miner_count
  FROM account_relation ar
  JOIN account_miner am ON am.account_id = ar.subordinate_id
  WHERE ar.superior_id = p_account_id
    AND ar.level = 1;

  -- 直推用户拥有的大于等于 3000 的矿机数量
  SELECT COUNT(*)
  INTO high_direct_miner_count
  FROM account_relation ar
  JOIN account_miner am ON am.account_id = ar.subordinate_id
  JOIN miner m ON m.id = am.miner_id
  WHERE ar.superior_id = p_account_id
    AND ar.level = 1
    AND m.price >= high_miner_price_threshold;

  IF high_direct_miner_count >= 3 THEN
    RETURN 20;
  ELSIF high_direct_miner_count >= 2 THEN
    RETURN 15;
  ELSIF high_direct_miner_count >= 1 THEN
    RETURN 10;
  ELSIF total_direct_miner_count >= 1 THEN
    RETURN 5;
  ELSE
    RETURN 0;
  END IF;
END;
$$;
