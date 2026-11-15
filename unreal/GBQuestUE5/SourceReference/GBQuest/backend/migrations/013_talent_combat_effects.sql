-- Add authoritative combat tuning to the generated talent catalogue.
-- Kept separate from migration 012 so installations that already applied 012 receive these values.
UPDATE mmorpg_talent_nodes
SET effect = effect || jsonb_build_object(
  'damageBonus', CASE WHEN node_type='passive' THEN 1 + (node_index / 12) ELSE 0 END,
  'damageMultiplier', CASE
    WHEN node_type='ultimate' THEN 3.0
    WHEN node_type='active' THEN 1.25 + LEAST(1.5, (node_index / 12) * 0.1)
    ELSE 1.0
  END,
  'manaCost', CASE
    WHEN node_type='ultimate' THEN 50
    WHEN node_type='active' THEN 5 + (node_index / 3)
    ELSE 0
  END
);
