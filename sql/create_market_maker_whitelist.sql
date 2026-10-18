CREATE TABLE IF NOT EXISTS market_maker_whitelist (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  CONSTRAINT uq_market_maker_whitelist_account_id UNIQUE (account_id),
  CONSTRAINT fk_market_maker_whitelist_account
    FOREIGN KEY (account_id)
    REFERENCES account(id)
    ON DELETE CASCADE
);
