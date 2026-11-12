-- Persistent social graph, character mail and realm-scoped 1v1 PvP queue.
CREATE TABLE IF NOT EXISTS character_friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_low_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  character_high_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CHECK (character_low_id < character_high_id),
  CHECK (requested_by IN (character_low_id, character_high_id)),
  UNIQUE (character_low_id, character_high_id)
);
CREATE INDEX IF NOT EXISTS character_friendships_inbox
  ON character_friendships(character_high_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS character_blocks (
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  blocked_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (character_id <> blocked_character_id),
  PRIMARY KEY(character_id,blocked_character_id)
);
CREATE INDEX IF NOT EXISTS character_blocks_reverse
  ON character_blocks(blocked_character_id,character_id);

CREATE TABLE IF NOT EXISTS character_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  sender_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  recipient_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  subject varchar(80) NOT NULL,
  body varchar(2000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  CHECK (sender_character_id <> recipient_character_id),
  CHECK (length(btrim(subject)) > 0),
  CHECK (length(btrim(body)) > 0)
);
CREATE INDEX IF NOT EXISTS character_mail_inbox
  ON character_mail(recipient_character_id,created_at DESC);
CREATE INDEX IF NOT EXISTS character_mail_expiry
  ON character_mail(expires_at);

CREATE TABLE IF NOT EXISTS pvp_queue_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  mode varchar(16) NOT NULL CHECK (mode IN ('duel')),
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 5000),
  status varchar(12) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','matched','cancelled','expired','completed')),
  match_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
CREATE UNIQUE INDEX IF NOT EXISTS pvp_queue_one_active_character
  ON pvp_queue_entries(character_id) WHERE status IN ('queued','matched');
CREATE INDEX IF NOT EXISTS pvp_queue_candidates
  ON pvp_queue_entries(realm_id,mode,rating,created_at,id) WHERE status='queued';

CREATE TABLE IF NOT EXISTS pvp_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  mode varchar(16) NOT NULL CHECK (mode IN ('duel')),
  status varchar(12) NOT NULL DEFAULT 'matched' CHECK (status IN ('matched','completed','forfeited','expired')),
  instance_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  winner_character_id uuid REFERENCES characters(id) ON DELETE SET NULL
);
ALTER TABLE pvp_queue_entries
  DROP CONSTRAINT IF EXISTS pvp_queue_entries_match_id_fkey;
ALTER TABLE pvp_queue_entries
  ADD CONSTRAINT pvp_queue_entries_match_id_fkey
  FOREIGN KEY (match_id) REFERENCES pvp_matches(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS pvp_match_members (
  match_id uuid NOT NULL REFERENCES pvp_matches(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  queue_entry_id uuid NOT NULL UNIQUE REFERENCES pvp_queue_entries(id) ON DELETE CASCADE,
  rating_at_match integer NOT NULL CHECK (rating_at_match BETWEEN 0 AND 5000),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(match_id,character_id)
);
CREATE INDEX IF NOT EXISTS pvp_match_members_character
  ON pvp_match_members(character_id,match_id);

CREATE TABLE IF NOT EXISTS pvp_character_ratings (
  character_id uuid PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  rating integer NOT NULL DEFAULT 1000 CHECK (rating BETWEEN 0 AND 5000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep the migration repeatable when an earlier version of migration 015 was already applied.
ALTER TABLE pvp_queue_entries DROP CONSTRAINT IF EXISTS pvp_queue_entries_status_check;
ALTER TABLE pvp_queue_entries ADD CONSTRAINT pvp_queue_entries_status_check
  CHECK (status IN ('queued','matched','cancelled','expired','completed'));
