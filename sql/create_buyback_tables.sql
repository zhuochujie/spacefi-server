ALTER TABLE account
  ADD COLUMN IF NOT EXISTS buyback_space_balance NUMERIC(28, 0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyback_usdt_balance NUMERIC(28, 0) NOT NULL DEFAULT 0;

DO $$ BEGIN
  CREATE TYPE buyback_signature_kind_enum AS ENUM ('deposit', 'withdraw');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE buyback_signature_status_enum AS ENUM ('pending', 'used', 'unused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE buyback_token_enum AS ENUM ('SPACE', 'USDT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE buyback_trade_type_enum AS ENUM ('user_sell', 'maker_buy');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE buyback_balance_log_type_enum AS ENUM ('deposit', 'trade', 'withdraw', 'withdraw_refund', 'fee_income');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS buyback_pool_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  available_space NUMERIC(28,0) NOT NULL DEFAULT 0,
  available_usdt NUMERIC(28,0) NOT NULL DEFAULT 0,
  daily_sell_space NUMERIC(28,0) NOT NULL DEFAULT 0,
  daily_maker_buy_space NUMERIC(28,0) NOT NULL DEFAULT 0,
  business_date VARCHAR(10) NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT INTO buyback_pool_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS buyback_signature (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  account VARCHAR(42) NOT NULL,
  kind buyback_signature_kind_enum NOT NULL,
  token buyback_token_enum NOT NULL,
  amount NUMERIC(28,0) NOT NULL,
  nonce VARCHAR NOT NULL UNIQUE,
  deadline INTEGER NOT NULL,
  signature VARCHAR(132) NOT NULL,
  status buyback_signature_status_enum NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_buyback_signature_status_deadline ON buyback_signature(status, deadline);
CREATE INDEX IF NOT EXISTS idx_buyback_signature_account_kind_status ON buyback_signature(account_id, kind, status);

CREATE TABLE IF NOT EXISTS buyback_trade (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  type buyback_trade_type_enum NOT NULL,
  space_amount NUMERIC(28,0) NOT NULL,
  price NUMERIC(28,0) NOT NULL,
  usdt_amount NUMERIC(28,0) NOT NULL,
  fee_amount NUMERIC(28,0) NOT NULL DEFAULT 0,
  subsidy_amount NUMERIC(28,0) NOT NULL DEFAULT 0,
  receiver_amount NUMERIC(28,0) NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buyback_trade_account_created ON buyback_trade(account_id, created_at);

CREATE TABLE IF NOT EXISTS buyback_balance_log (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  type buyback_balance_log_type_enum NOT NULL,
  token buyback_token_enum NOT NULL,
  amount NUMERIC(28,0) NOT NULL,
  balance_before NUMERIC(28,0) NOT NULL,
  balance_after NUMERIC(28,0) NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_buyback_balance_log_account_created ON buyback_balance_log(account_id, created_at);
