CREATE OR REPLACE PROCEDURE distribute_miner_rewards()
LANGUAGE plpgsql
AS $$
DECLARE
current_timestamp_sec integer;
miner_count integer;
miner_account_count integer;
miner_reward_total numeric;
raw_team_account_count integer;
raw_team_reward_total numeric;
team_allocation_count integer;
team_account_count integer;
team_reward_total numeric;
lost_team_reward_total numeric;
team_reward_bp numeric;
BEGIN

current_timestamp_sec := EXTRACT(EPOCH FROM NOW())::integer;

SELECT value::numeric
INTO team_reward_bp
FROM config
WHERE key = 'TEAM_REWARD_BP';

IF team_reward_bp IS NULL THEN
    RAISE EXCEPTION 'CONFIG_NOT_FOUND: TEAM_REWARD_BP';
END IF;

RAISE NOTICE '开始发放奖励，当前秒级时间戳：%', current_timestamp_sec;

-- 1. 计算每台矿机本轮实际矿机奖励
CREATE TEMP TABLE tmp_miner_rewards ON COMMIT DROP AS
SELECT
    am.id AS account_miner_id,
    am.account_id,
    LEAST(
    (current_timestamp_sec - am.last_reward_at)::numeric * am.reward_per_second,
    am.expected_reward - am.produced_reward
    ) AS reward
FROM account_miner am
WHERE am.produced_reward < am.expected_reward
    AND am.last_reward_at < current_timestamp_sec;

SELECT
    COUNT(*),
    COALESCE(SUM(reward), 0)
INTO miner_count, miner_reward_total
FROM tmp_miner_rewards
WHERE reward > 0;

RAISE NOTICE '第1步：计算矿机奖励完成，有奖励的矿机数量：%，矿机奖励总额：%', miner_count, miner_reward_total;

-- 2. 按账户汇总矿机奖励
CREATE TEMP TABLE tmp_account_miner_rewards ON COMMIT DROP AS
SELECT
    account_id,
    SUM(reward) AS reward
FROM tmp_miner_rewards
WHERE reward > 0
GROUP BY account_id;

SELECT COUNT(*)
INTO miner_account_count
FROM tmp_account_miner_rewards;

RAISE NOTICE '第2步：按账户汇总矿机奖励完成，获得矿机奖励的账户数量：%', miner_account_count;

-- 3. 写入矿机奖励资金明细：每台矿机一条
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
    t.reward,
    a.balance + COALESCE(
        SUM(t.reward) OVER (
            PARTITION BY t.account_id
            ORDER BY t.account_miner_id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ),
        0
    ),
    a.balance + SUM(t.reward) OVER (
        PARTITION BY t.account_id
        ORDER BY t.account_miner_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ),
    current_timestamp_sec
FROM account a
JOIN tmp_miner_rewards t ON t.account_id = a.id
WHERE t.reward > 0;

RAISE NOTICE '第3步：矿机奖励资金明细写入完成，写入条数：%', miner_count;

-- 4. 更新账户余额：矿机奖励
UPDATE account a
SET balance = a.balance + t.reward
FROM tmp_account_miner_rewards t
WHERE a.id = t.account_id
    AND t.reward > 0;

RAISE NOTICE '第4步：账户余额更新完成，矿机奖励总额：%', miner_reward_total;

-- 5. 更新矿机自身 produced_reward 和 last_reward_at
UPDATE account_miner am
SET
    produced_reward = am.produced_reward + t.reward,
    last_reward_at = current_timestamp_sec
FROM tmp_miner_rewards t
WHERE am.id = t.account_miner_id
    AND t.reward > 0;

RAISE NOTICE '第5步：矿机 produced_reward 和 last_reward_at 更新完成，更新矿机数量：%', miner_count;

-- 6. 计算每个上级账户理论团队奖励
CREATE TEMP TABLE tmp_raw_team_rewards ON COMMIT DROP AS
SELECT
    ar.superior_id AS account_id,
    SUM(t.reward * team_reward_bp / 10000) AS reward
FROM tmp_miner_rewards t
JOIN account_relation ar ON ar.subordinate_id = t.account_id
WHERE t.reward > 0
    AND ar.level <= compute_commission_level(ar.superior_id)
GROUP BY ar.superior_id;

SELECT
    COUNT(*),
    COALESCE(SUM(reward), 0)
INTO raw_team_account_count, raw_team_reward_total
FROM tmp_raw_team_rewards
WHERE reward > 0;

RAISE NOTICE '第6步：理论团队奖励计算完成，理论团队奖励账户数量：%，理论团队奖励总额：%', raw_team_account_count, raw_team_reward_total;

-- 7. 将团队奖励按上级自己的矿机顺序分配到 produced_reward 额度
CREATE TEMP TABLE tmp_team_reward_allocations ON COMMIT DROP AS
WITH available_miners AS (
    SELECT
    am.id AS account_miner_id,
    am.account_id,
    am.expected_reward - am.produced_reward AS remaining_reward,
    SUM(am.expected_reward - am.produced_reward) OVER (
        PARTITION BY am.account_id
        ORDER BY am.created_at ASC, am.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) AS previous_remaining_reward
    FROM account_miner am
    JOIN tmp_raw_team_rewards tr ON tr.account_id = am.account_id
    WHERE am.produced_reward < am.expected_reward
),
allocated AS (
    SELECT
    am.account_miner_id,
    am.account_id,
    LEAST(
        am.remaining_reward,
        GREATEST(
        0,
        tr.reward - COALESCE(am.previous_remaining_reward, 0)
        )
    ) AS reward
    FROM available_miners am
    JOIN tmp_raw_team_rewards tr ON tr.account_id = am.account_id
)
SELECT
    account_miner_id,
    account_id,
    reward
FROM allocated
WHERE reward > 0;

SELECT
    COUNT(*),
    COALESCE(SUM(reward), 0)
INTO team_allocation_count, team_reward_total
FROM tmp_team_reward_allocations
WHERE reward > 0;

lost_team_reward_total := raw_team_reward_total - team_reward_total;

RAISE NOTICE '第7步：团队奖励按矿机剩余额度分配完成，分配到的矿机数量：%，实际可发放团队奖励总额：%，超出额度未发放团队奖励总额：%',
    team_allocation_count,
    team_reward_total,
    lost_team_reward_total;

-- 8. 汇总实际可发放团队奖励
CREATE TEMP TABLE tmp_account_team_rewards ON COMMIT DROP AS
SELECT
    account_id,
    SUM(reward) AS reward
FROM tmp_team_reward_allocations
GROUP BY account_id;

SELECT COUNT(*)
INTO team_account_count
FROM tmp_account_team_rewards;

RAISE NOTICE '第8步：实际团队奖励按账户汇总完成，获得团队奖励的账户数量：%', team_account_count;

-- 9. 写入团队奖励资金明细：每个账户一条
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
    'team_reward',
    'SPACE',
    t.reward,
    a.balance,
    a.balance + t.reward,
    current_timestamp_sec
FROM account a
JOIN tmp_account_team_rewards t ON t.account_id = a.id
WHERE t.reward > 0;

RAISE NOTICE '第9步：团队奖励资金明细写入完成，写入条数：%', team_account_count;

-- 10. 更新账户余额：团队奖励
UPDATE account a
SET balance = a.balance + t.reward
FROM tmp_account_team_rewards t
WHERE a.id = t.account_id
    AND t.reward > 0;

RAISE NOTICE '第10步：账户余额更新完成，团队奖励总额：%', team_reward_total;

-- 11. 团队奖励也增加上级自己的矿机 produced_reward
UPDATE account_miner am
SET produced_reward = am.produced_reward + t.reward
FROM tmp_team_reward_allocations t
WHERE am.id = t.account_miner_id
    AND t.reward > 0;

RAISE NOTICE '第11步：团队奖励已增加到上级矿机 produced_reward，更新矿机数量：%', team_allocation_count;
RAISE NOTICE '奖励发放完成，矿机奖励总额：%，团队奖励实际发放总额：%，团队奖励未发放总额：%',
    miner_reward_total,
    team_reward_total,
    lost_team_reward_total;
END;
$$;
