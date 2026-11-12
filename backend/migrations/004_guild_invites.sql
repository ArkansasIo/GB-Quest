-- Guild invitation persistence. Additive and safe to rerun.
CREATE TABLE IF NOT EXISTS guild_invites (
 id uuid PRIMARY KEY,
 guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
 inviter_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 invitee_character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
 status varchar(12) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','expired','cancelled')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_invites_inbox_idx ON guild_invites(invitee_character_id,status,expires_at);
