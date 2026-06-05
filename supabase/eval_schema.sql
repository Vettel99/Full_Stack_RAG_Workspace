-- eval_runs: one record per execution of the evaluation harness
CREATE TABLE IF NOT EXISTS eval_runs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  average_score FLOAT       NOT NULL
);

-- eval_details: one record per question within a run
CREATE TABLE IF NOT EXISTS eval_details (
  id              UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id          UUID  NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  question        TEXT  NOT NULL,
  expected_answer TEXT  NOT NULL,
  actual_answer   TEXT  NOT NULL,
  score           FLOAT NOT NULL,
  reasoning       TEXT  NOT NULL
);

-- Index for efficient per-run lookups
CREATE INDEX IF NOT EXISTS eval_details_run_id_idx
  ON eval_details (run_id);
