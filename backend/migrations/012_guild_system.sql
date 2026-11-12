-- Realm-scoped persistent guilds. One guild per character.
CREATE TABLE IF NOT EXISTS guilds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 realm_id varchar(24) NOT NULL REFERENCES realms(id) ON DELETE CASCADE,
 name varchar(32) NOT NULL,
 leader_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (char_length(trim(name)) BETWEEN 3 AND 32)
);
CREATE UNIQUE INDEX IF NOT EXISTS guilds_realm_name_uq ON guilds(realm_id,lower(name));
CREATE TABLE IF NOT EXISTS guild_members (
 guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
 character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
 rank varchar(12) NOT NULL CHECK (rank IN ('leader','officer','member')),
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(guild_id,character_id)
);
CREATE INDEX IF NOT EXISTS guild_members_order_idx ON guild_members(guild_id,joined_at,character_id);
CREATE TABLE IF NOT EXISTS guild_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
 inviter_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 invitee_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 status varchar(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 responded_at timestamptz,
 CHECK(inviter_character_id<>invitee_character_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS guild_invites_pending_uq ON guild_invites(guild_id,invitee_character_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS guild_invites_inbox_idx ON guild_invites(invitee_character_id,expires_at) WHERE status='pending';
