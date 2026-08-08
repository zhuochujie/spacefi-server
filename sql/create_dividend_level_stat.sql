CREATE TABLE IF NOT EXISTS dividend_level_stat (
  id bigserial PRIMARY KEY,
  round_at integer NOT NULL,
  category dividend_rule_category_enum NOT NULL,
  token account_balance_log_token_enum NOT NULL,
  level integer NOT NULL,
  bp integer NOT NULL DEFAULT 0,
  recipient_count integer NOT NULL DEFAULT 0,
  per_user_amount numeric(28, 0) NOT NULL DEFAULT 0,
  total_amount numeric(28, 0) NOT NULL DEFAULT 0,
  fallback_used boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_dividend_level_stat_round_at
  ON dividend_level_stat(round_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dividend_level_stat_round_group
  ON dividend_level_stat(round_at, category, token, level);
