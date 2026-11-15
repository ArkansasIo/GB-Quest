-- Server-side session revocation for the MMO service's signed 30-day bearer tokens.
-- Every token carries the account's token_version at issue time (claim "tv"; tokens issued before this
-- migration have no claim and count as version 0, so existing sessions stay valid). POST /api/logout and
-- POST /api/password increment the version, which invalidates every earlier token for that account on every
-- server instance at its next authentication check.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_token_version_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_token_version_check CHECK (token_version >= 0);
