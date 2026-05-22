-- 重新计算所有账户的系统 VIP 等级。
--
-- 规则说明：
-- 1. 最高等级为 V5。
-- 2. V1：至少有 3 个直推，并且至少 3 个直推市场业绩 >= 3000。
-- 3. V2~V5：至少 3 个不同直推市场中，分别存在至少 1 个 V(n-1) 用户。
-- 4. “直推市场”包含直推本人，以及该直推下面的所有团队成员。
-- 5. 市场业绩使用 miner_purchase_signature.price 统计，只计算 status = 'used' 的购买签名，单位为 wei。
-- 6. 只更新 account.vip_level，不影响 account.manual_vip_level。
--
-- 调用方式：
-- CALL recompute_vip_levels();

CREATE OR REPLACE PROCEDURE recompute_vip_levels()
LANGUAGE plpgsql
AS $$
DECLARE
  current_level integer;
  affected_count integer;
  max_level integer := 5;
  market_threshold numeric;
BEGIN
  SELECT value::numeric
  INTO market_threshold
  FROM config
  WHERE key = 'VIP_V1_MARKET_THRESHOLD_WEI';

  IF market_threshold IS NULL THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: VIP_V1_MARKET_THRESHOLD_WEI';
  END IF;

  -- 临时保存本次计算结果，避免计算过程中的中间状态污染 account 表。
  CREATE TEMP TABLE tmp_vip_result ON COMMIT DROP AS
  SELECT
    id AS account_id,
    0::integer AS vip_level
  FROM account;

  -- 构建每个账户的直推市场成员表。
  --
  -- superior_id：当前要计算等级的账户。
  -- direct_id：当前账户的某个直推。
  -- member_id：该直推市场中的成员，包括直推本人和直推下面所有团队成员。
  CREATE TEMP TABLE tmp_direct_branch ON COMMIT DROP AS
  SELECT
    direct.superior_id,
    direct.subordinate_id AS direct_id,
    direct.subordinate_id AS member_id
  FROM account_relation direct
  WHERE direct.level = 1

  UNION ALL

  SELECT
    direct.superior_id,
    direct.subordinate_id AS direct_id,
    team.subordinate_id AS member_id
  FROM account_relation direct
  JOIN account_relation team
    ON team.superior_id = direct.subordinate_id
  WHERE direct.level = 1;

  -- 临时表索引：加速按用户/直推市场聚合，以及按成员匹配事件。
  CREATE INDEX idx_tmp_direct_branch_superior_direct
  ON tmp_direct_branch(superior_id, direct_id);

  CREATE INDEX idx_tmp_direct_branch_member
  ON tmp_direct_branch(member_id);

  -- 计算每个直推市场的业绩。
  --
  -- 一个直推市场的业绩 = 该市场所有成员的购买矿机 price 总和。
  CREATE TEMP TABLE tmp_direct_market ON COMMIT DROP AS
  SELECT
    b.superior_id,
    b.direct_id,
    COALESCE(SUM(mps.price), 0) AS market_amount
  FROM tmp_direct_branch b
  LEFT JOIN miner_purchase_signature mps
    ON mps.account_id = b.member_id
   AND mps.status = 'used'
  GROUP BY b.superior_id, b.direct_id;

  CREATE INDEX idx_tmp_direct_market_superior
  ON tmp_direct_market(superior_id);

  -- 计算 V1：
  -- 至少 3 个直推市场，且至少 3 个直推市场业绩达到 3000。
  UPDATE tmp_vip_result r
  SET vip_level = 1
  WHERE r.account_id IN (
    SELECT
      dm.superior_id
    FROM tmp_direct_market dm
    GROUP BY dm.superior_id
    HAVING COUNT(*) >= 3
       AND COUNT(*) FILTER (WHERE dm.market_amount >= market_threshold) >= 3
  );

  -- 从 V2 开始逐级计算：
  -- Vn = 至少 3 个不同直推市场里，分别存在至少 1 个 V(n-1) 用户。
  --
  -- 注意：这里查询的是 tmp_vip_result，不直接查 account.vip_level，
  -- 确保每一级都基于本轮已经完整计算出的低一级结果。
  current_level := 2;

  LOOP
    EXIT WHEN current_level > max_level;

    UPDATE tmp_vip_result r
    SET vip_level = current_level
    WHERE r.vip_level < current_level
      AND r.account_id IN (
        SELECT
          b.superior_id
        FROM tmp_direct_branch b
        JOIN tmp_vip_result child_vip
          ON child_vip.account_id = b.member_id
        WHERE child_vip.vip_level >= current_level - 1
        GROUP BY b.superior_id
        HAVING COUNT(DISTINCT b.direct_id) >= 3
      );

    GET DIAGNOSTICS affected_count = ROW_COUNT;

    -- 如果本轮没有任何账户升级，后续更高等级也不可能产生，提前结束。
    EXIT WHEN affected_count = 0;

    current_level := current_level + 1;
  END LOOP;

  -- 最后统一写回正式账户表。
  UPDATE account a
  SET vip_level = r.vip_level
  FROM tmp_vip_result r
  WHERE a.id = r.account_id
    AND a.vip_level <> r.vip_level;
END;
$$;
