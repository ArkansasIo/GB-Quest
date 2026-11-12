-- Run daily using psql or the platform's scheduled database job.
DELETE FROM player_whispers WHERE created_at < now() - interval '30 days';
DELETE FROM world_chat_messages WHERE created_at < now() - interval '30 days';
DELETE FROM world_presence WHERE expires_at <= now();
DELETE FROM player_mail WHERE expires_at <= now() AND claimed_at IS NULL;
