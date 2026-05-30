CREATE OR REPLACE PROCEDURE distribute_free_miner_rewards()
LANGUAGE plpgsql
AS $$
DECLARE
current_timestamp_sec integer;
free_miner_count integer;
free_miner_reward_total numeric;
BEGIN

current_timestamp_sec := EXTRACT(EPOCH FROM NOW())::integer;

RAISE NOTICE '开始发放免费矿机奖励，当前秒级时间戳：%', current_timestamp_sec;

CREATE TEMP TABLE tmp_free_miner_rewards ON COMMIT DROP AS
SELECT
    fm.id AS free_miner_id,
    LEAST(
        (current_timestamp_sec - fm.last_reward_at)::numeric * fm.reward_per_second,
        fm.expected_reward - fm.produced_reward
    ) AS reward
FROM free_miner fm
WHERE fm.produced_reward < fm.expected_reward
    AND fm.last_reward_at < current_timestamp_sec;

SELECT
    COUNT(*),
    COALESCE(SUM(reward), 0)
INTO free_miner_count, free_miner_reward_total
FROM tmp_free_miner_rewards
WHERE reward > 0;

RAISE NOTICE '免费矿机奖励计算完成，有奖励的免费矿机数量：%，奖励总额：%', free_miner_count, free_miner_reward_total;

UPDATE free_miner fm
SET
    produced_reward = fm.produced_reward + t.reward,
    last_reward_at = current_timestamp_sec
FROM tmp_free_miner_rewards t
WHERE fm.id = t.free_miner_id
    AND t.reward > 0;

RAISE NOTICE '免费矿机 produced_reward 和 last_reward_at 更新完成，更新矿机数量：%', free_miner_count;

END;
$$;
