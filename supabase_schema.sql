-- ============================================================
--  Club Night — Supabase SQL Schema
--  Run this in the Supabase SQL Editor (Project → SQL Editor)
--  Safe to run on a fresh project; use the ALTER TABLE at the
--  bottom if upgrading an existing database.
-- ============================================================


-- ── 1. players ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL,
  handle        TEXT        NOT NULL,
  color         TEXT        NOT NULL DEFAULT '#f0c430',
  photo_url     TEXT,
  total_points  INTEGER     NOT NULL DEFAULT 0,
  wins          INTEGER     NOT NULL DEFAULT 0,
  losses        INTEGER     NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 2. courts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT    NOT NULL DEFAULT 'Court 1',
  max_players INTEGER NOT NULL DEFAULT 4,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 3. court_players ─────────────────────────────────────────
--  Tracks which players are currently on which court.
--  Rows are deleted when a game finishes or a player is moved.
CREATE TABLE IF NOT EXISTS court_players (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  court_id   BIGINT NOT NULL REFERENCES courts(id)  ON DELETE CASCADE,
  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (court_id, player_id)
);


-- ── 4. waiting_list ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waiting_list (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id  BIGINT      NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id)   -- a player can only be in the queue once
);


-- ── 5. score_history ─────────────────────────────────────────
--  One row per score recorded on a court (mid-game or final).
CREATE TABLE IF NOT EXISTS score_history (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  court_id     BIGINT  NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  team1_label  TEXT    NOT NULL,
  team2_label  TEXT    NOT NULL,
  score1       INTEGER NOT NULL DEFAULT 0,
  score2       INTEGER NOT NULL DEFAULT 0,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 6. player_game_history ───────────────────────────────────
--  One row per player per finished game.
--  opponent_player_ids stores the IDs of every player on the
--  opposing team — used for Rivals and Ghosted calculations.
CREATE TABLE IF NOT EXISTS player_game_history (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id            BIGINT   NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  win                  BOOLEAN  NOT NULL DEFAULT FALSE,
  points               INTEGER  NOT NULL DEFAULT 0,
  score_for            INTEGER  NOT NULL DEFAULT 0,
  score_against        INTEGER  NOT NULL DEFAULT 0,
  team_label           TEXT     NOT NULL DEFAULT '',
  opponent_label       TEXT     NOT NULL DEFAULT '',
  opponent_player_ids  BIGINT[] NOT NULL DEFAULT '{}',
  teammate_player_ids  BIGINT[] NOT NULL DEFAULT '{}',
  played_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 7. RPC: increment_player_stats ───────────────────────────
--  Atomically increments wins, losses and total_points for a
--  player to avoid read-then-write race conditions when
--  multiple players finish a game at the same time.
CREATE OR REPLACE FUNCTION increment_player_stats(
  p_id      BIGINT,
  p_points  INTEGER,
  p_wins    INTEGER,
  p_losses  INTEGER
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE players
  SET
    total_points = total_points + p_points,
    wins         = wins         + p_wins,
    losses       = losses       + p_losses
  WHERE id = p_id;
$$;


-- ── 8. Realtime ───────────────────────────────────────────────
--  Enable Postgres realtime replication for live multi-device
--  sync. Run each line separately if needed.
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE courts;
ALTER PUBLICATION supabase_realtime ADD TABLE court_players;
ALTER PUBLICATION supabase_realtime ADD TABLE waiting_list;
ALTER PUBLICATION supabase_realtime ADD TABLE score_history;
ALTER PUBLICATION supabase_realtime ADD TABLE player_game_history;


-- ── 9. Row Level Security ─────────────────────────────────────
--  The app uses the anon key so RLS must allow public access.
--  Only enable this if you are NOT adding auth later.
ALTER TABLE players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE courts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE court_players      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list       ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public access" ON players             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public access" ON courts              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public access" ON court_players       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public access" ON waiting_list        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public access" ON score_history       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public access" ON player_game_history FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
--  UPGRADING AN EXISTING DATABASE?
--  Run only the statements below if your tables already exist.
-- ============================================================

-- Add opponent_player_ids if missing (needed for Rivals/Ghosted)
-- ALTER TABLE player_game_history
--   ADD COLUMN IF NOT EXISTS opponent_player_ids BIGINT[] NOT NULL DEFAULT '{}';

-- Add teammate_player_ids if missing (needed for Partners)
-- ALTER TABLE player_game_history
--   ADD COLUMN IF NOT EXISTS teammate_player_ids BIGINT[] NOT NULL DEFAULT '{}';

-- Add photo_url if missing
-- ALTER TABLE players
--   ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add is_deleted soft-delete flag if missing
-- ALTER TABLE players
--   ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
