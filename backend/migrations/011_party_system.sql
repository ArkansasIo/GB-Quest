-- Persistent same-realm parties: one party per character, five members maximum.
CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  realm_id uuid NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL DEFAULT 'member' CHECK (role IN ('leader','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, character_id),
  UNIQUE (character_id)
);

CREATE INDEX IF NOT EXISTS party_members_party_joined_idx
  ON party_members(party_id, joined_at, character_id);

CREATE TABLE IF NOT EXISTS party_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  inviter_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  invitee_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status varchar(12) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  CHECK (inviter_character_id <> invitee_character_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS party_invites_one_pending_idx
  ON party_invites(party_id, invitee_character_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS party_invites_inbox_idx
  ON party_invites(invitee_character_id, expires_at) WHERE status='pending';

-- Backfill any existing party membership is intentionally omitted: this migration
-- introduces parties as a new feature and does not infer groups from proximity.
