-- Guild vault balances and immutable audit ledger.
CREATE TABLE IF NOT EXISTS guild_bank_balances (
  guild_id uuid PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  gold bigint NOT NULL DEFAULT 0 CHECK (gold >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO guild_bank_balances(guild_id,gold)
SELECT id,0 FROM guilds ON CONFLICT(guild_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS guild_bank_transactions (
  id bigserial PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  action varchar(8) NOT NULL CHECK(action IN ('deposit','withdraw')),
  amount bigint NOT NULL CHECK(amount > 0),
  wallet_gold_after bigint NOT NULL CHECK(wallet_gold_after >= 0),
  guild_gold_after bigint NOT NULL CHECK(guild_gold_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_bank_transactions_history_idx
 ON guild_bank_transactions(guild_id,created_at DESC,id DESC);
