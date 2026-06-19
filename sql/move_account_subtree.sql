-- Move an account and its complete referral subtree under a new direct superior.
--
-- The account_relation table is a closure table: each subordinate has one row
-- for every superior, and level stores the distance between them. Internal
-- relationships inside the moved subtree are preserved; only links between
-- the subtree and the old/new ancestor chains are replaced.
--
-- Historical rewards are not changed. The new relationship affects team
-- statistics, VIP levels, commission levels, and rewards calculated later.
--
-- Usage:
-- CALL move_account_subtree(100, 200);

CREATE OR REPLACE PROCEDURE move_account_subtree(
  p_account_id integer,
  p_new_superior_id integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_superior_id integer;
  current_superior_count integer;
  deleted_relation_count integer;
  inserted_relation_count integer;
BEGIN
  IF p_account_id IS NULL OR p_new_superior_id IS NULL THEN
    RAISE EXCEPTION 'ACCOUNT_ID_REQUIRED';
  END IF;

  IF p_account_id = p_new_superior_id THEN
    RAISE EXCEPTION 'ACCOUNT_CANNOT_BE_OWN_SUPERIOR';
  END IF;

  -- Serialize tree moves and block concurrent relation reads/writes. An
  -- exclusive table lock is intentional: registration reads the recommender's
  -- ancestor chain before inserting it, so allowing that read during a move
  -- could insert a stale chain after the move commits.
  PERFORM pg_advisory_xact_lock(hashtext('move_account_subtree'));

  -- Use the reward procedure's lock as well. If rewards are already running,
  -- this move waits; if a reward run starts during the move, its try-lock fails
  -- instead of calculating against two different referral snapshots.
  PERFORM pg_advisory_xact_lock(hashtext('distribute_miner_rewards'));

  LOCK TABLE account_relation IN ACCESS EXCLUSIVE MODE;

  PERFORM 1
  FROM account
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: %', p_account_id;
  END IF;

  PERFORM 1
  FROM account
  WHERE id = p_new_superior_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEW_SUPERIOR_NOT_FOUND: %', p_new_superior_id;
  END IF;

  -- A descendant cannot become the new superior because that would create a
  -- cycle. The closure table makes this check independent of subtree depth.
  IF EXISTS (
    SELECT 1
    FROM account_relation
    WHERE superior_id = p_account_id
      AND subordinate_id = p_new_superior_id
  ) THEN
    RAISE EXCEPTION 'NEW_SUPERIOR_IS_DESCENDANT';
  END IF;

  SELECT COUNT(*), MIN(superior_id)
  INTO current_superior_count, current_superior_id
  FROM account_relation
  WHERE subordinate_id = p_account_id
    AND level = 1;

  IF current_superior_count > 1 THEN
    RAISE EXCEPTION 'INVALID_REFERRAL_TREE_MULTIPLE_DIRECT_SUPERIORS';
  END IF;

  -- Repeating the same request is safe and does not trigger a VIP recompute.
  IF current_superior_id = p_new_superior_id THEN
    RETURN;
  END IF;

  -- Remove only old-ancestor-to-subtree links. Relations whose superior is
  -- inside the subtree are deliberately retained.
  WITH subtree AS (
    SELECT p_account_id AS account_id

    UNION ALL

    SELECT subordinate_id
    FROM account_relation
    WHERE superior_id = p_account_id
  ),
  old_ancestors AS (
    SELECT superior_id AS account_id
    FROM account_relation
    WHERE subordinate_id = p_account_id
  )
  DELETE FROM account_relation relation
  USING subtree, old_ancestors
  WHERE relation.superior_id = old_ancestors.account_id
    AND relation.subordinate_id = subtree.account_id;

  GET DIAGNOSTICS deleted_relation_count = ROW_COUNT;

  -- Connect every new ancestor to every subtree member. For example, if the
  -- new superior is 2 levels below one of its ancestors and a subtree member
  -- is 3 levels below the moved account, their new distance is 2 + 1 + 3.
  WITH subtree AS (
    SELECT p_account_id AS account_id, 0 AS subtree_level

    UNION ALL

    SELECT subordinate_id, level
    FROM account_relation
    WHERE superior_id = p_account_id
  ),
  new_ancestors AS (
    SELECT p_new_superior_id AS account_id, 1 AS account_level

    UNION ALL

    SELECT superior_id, level + 1
    FROM account_relation
    WHERE subordinate_id = p_new_superior_id
  )
  INSERT INTO account_relation (
    superior_id,
    subordinate_id,
    level
  )
  SELECT
    new_ancestors.account_id,
    subtree.account_id,
    new_ancestors.account_level + subtree.subtree_level
  FROM new_ancestors
  CROSS JOIN subtree;

  GET DIAGNOSTICS inserted_relation_count = ROW_COUNT;

  -- Referral changes can both upgrade and downgrade users on the old and new
  -- ancestor chains. A full snapshot recompute is slower but keeps all levels
  -- correct and is appropriate for this infrequent administrative operation.
  CALL recompute_vip_levels();

  RAISE NOTICE
    'Moved account % under %, deleted % relations and inserted % relations',
    p_account_id,
    p_new_superior_id,
    deleted_relation_count,
    inserted_relation_count;
END;
$$;
