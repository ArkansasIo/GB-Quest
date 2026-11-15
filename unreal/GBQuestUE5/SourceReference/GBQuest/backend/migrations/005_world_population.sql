-- Persistent peak population tracking for the world dashboard.
CREATE TABLE IF NOT EXISTS world_population_peak (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  peak_concurrent integer NOT NULL DEFAULT 0 CHECK (peak_concurrent >= 0),
  peak_at timestamptz
);
INSERT INTO world_population_peak(id, peak_concurrent) VALUES(true, 0)
ON CONFLICT(id) DO NOTHING;
