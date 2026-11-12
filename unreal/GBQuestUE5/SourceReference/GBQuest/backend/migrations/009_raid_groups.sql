-- Persistent same-realm raid groups. Membership is one raid per character.
CREATE TABLE IF NOT EXISTS raid_groups (
  id uuid PRIMARY KEY,
  realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
  leader_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name varchar(40) NOT NULL DEFAULT '',
  raid_size smallint NOT NULL DEFAULT 10 CHECK (raid_size IN (10,20,40)),
  status varchar(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disbanded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raid_groups_realm_status_idx ON raid_groups(realm_id,status,created_at DESC);
CREATE TABLE IF NOT EXISTS raid_group_members (
  raid_group_id uuid NOT NULL REFERENCES raid_groups(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL DEFAULT 'damage' CHECK (role IN ('tank','healer','damage','support')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (raid_group_id,character_id),
  UNIQUE (character_id)
);
CREATE INDEX IF NOT EXISTS raid_group_members_character_idx ON raid_group_members(character_id);
CREATE TABLE IF NOT EXISTS raid_invites (
  id uuid PRIMARY KEY,
  raid_group_id uuid NOT NULL REFERENCES raid_groups(id) ON DELETE CASCADE,
  inviter_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  invitee_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status varchar(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS raid_invites_inbox_idx ON raid_invites(invitee_character_id,status,expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS raid_invites_pending_unique_idx
  ON raid_invites(raid_group_id,invitee_character_id) WHERE status='pending';
