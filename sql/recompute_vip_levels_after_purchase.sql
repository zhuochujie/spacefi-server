-- 购买矿机后，实时重算 buyer 的所有上级 VIP 等级。
--
-- 适用场景：
-- 1. buyer 自己购买矿机不参与 buyer 自己的 V1 计算。
-- 2. buyer 的购买会计入所有上级的某个直推市场业绩。
-- 3. 因此购买后只需要从 buyer 的直接上级开始，沿推荐链向上逐级重算。
--
-- 调用方式：
-- CALL recompute_vip_levels_after_purchase(123);
--
-- 注意：
-- 1. 该过程只更新 account.vip_level，不影响 account.manual_vip_level。
-- 2. 该过程依赖当前 account.vip_level 作为下级等级判断依据。
-- 3. 会按 level ASC 从近到远更新上级，保证下级升级后，上级计算能读取到最新等级。

CREATE OR REPLACE FUNCTION compute_account_vip_level(p_account_id integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  current_level integer;
  max_level integer := 5;
  computed_level integer := 0;
  market_threshold numeric;
  qualified_branch_count integer;
BEGIN
  SELECT value::numeric
  INTO market_threshold
  FROM config
  WHERE key = 'VIP_V1_MARKET_THRESHOLD_WEI';

  IF market_threshold IS NULL THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: VIP_V1_MARKET_THRESHOLD_WEI';
  END IF;

  -- V1：
  -- 至少 3 个直推，并且至少 3 个直推市场业绩 >= 3000。
  --
  -- 直推市场 = 直推本人 + 直推下面所有团队成员。
  -- 不包含 p_account_id 自己购买的矿机。
  WITH direct_branch AS (
    SELECT
      direct.subordinate_id AS direct_id,
      direct.subordinate_id AS member_id
    FROM account_relation direct
    WHERE direct.superior_id = p_account_id
      AND direct.level = 1

    UNION ALL

    SELECT
      direct.subordinate_id AS direct_id,
      team.subordinate_id AS member_id
    FROM account_relation direct
    JOIN account_relation team
      ON team.superior_id = direct.subordinate_id
    WHERE direct.superior_id = p_account_id
      AND direct.level = 1
  ),
  direct_market AS (
    SELECT
      b.direct_id,
      COALESCE(SUM(mps.price), 0) AS market_amount
    FROM direct_branch b
    LEFT JOIN miner_purchase_signature mps
      ON mps.account_id = b.member_id
     AND mps.status = 'used'
    GROUP BY b.direct_id
  )
  SELECT COUNT(*) FILTER (WHERE market_amount >= market_threshold)
  INTO qualified_branch_count
  FROM direct_market;

  IF qualified_branch_count >= 3 THEN
    computed_level := 1;
  ELSE
    RETURN 0;
  END IF;

  -- V2 ~ V5：
  -- Vn = 至少 3 个不同直推市场里，各存在至少 1 个 V(n-1) 用户。
  current_level := 2;

  LOOP
    EXIT WHEN current_level > max_level;

    WITH direct_branch AS (
      SELECT
        direct.subordinate_id AS direct_id,
        direct.subordinate_id AS member_id
      FROM account_relation direct
      WHERE direct.superior_id = p_account_id
        AND direct.level = 1

      UNION ALL

      SELECT
        direct.subordinate_id AS direct_id,
        team.subordinate_id AS member_id
      FROM account_relation direct
      JOIN account_relation team
        ON team.superior_id = direct.subordinate_id
      WHERE direct.superior_id = p_account_id
        AND direct.level = 1
    )
    SELECT COUNT(DISTINCT b.direct_id)
    INTO qualified_branch_count
    FROM direct_branch b
    JOIN account a
      ON a.id = b.member_id
    WHERE a.vip_level >= current_level - 1;

    IF qualified_branch_count >= 3 THEN
      computed_level := current_level;
      current_level := current_level + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  RETURN computed_level;
END;
$$;

CREATE OR REPLACE PROCEDURE recompute_vip_levels_after_purchase(p_buyer_account_id integer)
LANGUAGE plpgsql
AS $$
DECLARE
  superior_record record;
  new_vip_level integer;
BEGIN
  -- buyer 自己购买矿机不影响 buyer 自己的 V1；
  -- 只需要重算 buyer 的所有上级。
  FOR superior_record IN
    SELECT
      ar.superior_id AS account_id,
      ar.level
    FROM account_relation ar
    WHERE ar.subordinate_id = p_buyer_account_id
    ORDER BY ar.level ASC
  LOOP
    new_vip_level := compute_account_vip_level(superior_record.account_id);

    UPDATE account
    SET vip_level = new_vip_level
    WHERE id = superior_record.account_id
      AND vip_level <> new_vip_level;
  END LOOP;
END;
$$;
