-- ============================================================
--  Club Night — Demo Data
--  Populates all tables with realistic data to validate the
--  History page sections: charts, Rivals, Partners, Ghosted,
--  and Complete History modal.
--
--  IMPORTANT: Run this on a clean database (no existing data).
--  If you already have players, clear tables first:
--
  TRUNCATE player_game_history, score_history, court_players,
           waiting_list, courts, players RESTART IDENTITY CASCADE;
-- ============================================================


-- ── 1. Players ───────────────────────────────────────────────
INSERT INTO players (name, handle, color, wins, losses, total_points) VALUES
  ('Alice Morgan',  'alice_m',   '#f0c430', 0, 0, 0),
  ('Ben Clarke',    'ben_c',     '#e05c2a', 0, 0, 0),
  ('Clara Singh',   'clara_s',   '#2ecc71', 0, 0, 0),
  ('Dave Hughes',   'dave_h',    '#3498db', 0, 0, 0),
  ('Emma Wilson',   'emma_w',    '#9b59b6', 0, 0, 0),
  ('Frank Osei',    'frank_o',   '#e74c3c', 0, 0, 0);
-- wins/losses/total_points are set via game history inserts below


-- ── 2. Courts ────────────────────────────────────────────────
INSERT INTO courts (name, max_players) VALUES
  ('Court 1', 4),
  ('Court 2', 4);


-- ── 3. Game History ──────────────────────────────────────────
--  We simulate 3 club nights over 3 weeks.
--  Player IDs will be 1-6 assuming a clean DB.
--  Each game has 4 players: team of 2 vs team of 2.
--
--  Game breakdown designed to test:
--    Alice  — has Rivals (never beaten Frank), Partners (Clara),
--             Ghosted (Emma is her least faced opponent)
--    Charts — enough games across dates for both line charts

-- ─── Club Night 1 (3 weeks ago) ──────────────────────────────

-- Game 1: Alice & Clara vs Ben & Dave  →  Alice wins 21-15
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (1, true,  21, 21, 15, 'Alice & Clara', 'Ben & Dave',  ARRAY[2,4], ARRAY[3], NOW() - INTERVAL '21 days'),
  (3, true,  21, 21, 15, 'Alice & Clara', 'Ben & Dave',  ARRAY[2,4], ARRAY[1], NOW() - INTERVAL '21 days'),
  (2, false, 15, 15, 21, 'Ben & Dave',   'Alice & Clara', ARRAY[1,3], ARRAY[4], NOW() - INTERVAL '21 days'),
  (4, false, 15, 15, 21, 'Ben & Dave',   'Alice & Clara', ARRAY[1,3], ARRAY[2], NOW() - INTERVAL '21 days');

-- Game 2: Alice & Dave vs Clara & Ben  →  Clara wins 21-18
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (1, false, 18, 18, 21, 'Alice & Dave', 'Clara & Ben', ARRAY[3,2], ARRAY[4], NOW() - INTERVAL '21 days' + INTERVAL '30 minutes'),
  (4, false, 18, 18, 21, 'Alice & Dave', 'Clara & Ben', ARRAY[3,2], ARRAY[1], NOW() - INTERVAL '21 days' + INTERVAL '30 minutes'),
  (3, true,  21, 21, 18, 'Clara & Ben',  'Alice & Dave', ARRAY[1,4], ARRAY[2], NOW() - INTERVAL '21 days' + INTERVAL '30 minutes'),
  (2, true,  21, 21, 18, 'Clara & Ben',  'Alice & Dave', ARRAY[1,4], ARRAY[3], NOW() - INTERVAL '21 days' + INTERVAL '30 minutes');

-- Game 3: Frank & Emma vs Alice & Ben  →  Frank wins 21-11
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (6, true,  21, 21, 11, 'Frank & Emma', 'Alice & Ben', ARRAY[1,2], ARRAY[5], NOW() - INTERVAL '21 days' + INTERVAL '60 minutes'),
  (5, true,  21, 21, 11, 'Frank & Emma', 'Alice & Ben', ARRAY[1,2], ARRAY[6], NOW() - INTERVAL '21 days' + INTERVAL '60 minutes'),
  (1, false, 11, 11, 21, 'Alice & Ben',  'Frank & Emma', ARRAY[6,5], ARRAY[2], NOW() - INTERVAL '21 days' + INTERVAL '60 minutes'),
  (2, false, 11, 11, 21, 'Alice & Ben',  'Frank & Emma', ARRAY[6,5], ARRAY[1], NOW() - INTERVAL '21 days' + INTERVAL '60 minutes');


-- ─── Club Night 2 (2 weeks ago) ──────────────────────────────

-- Game 4: Alice & Emma vs Frank & Clara  →  Frank wins 21-14
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (1, false, 14, 14, 21, 'Alice & Emma',  'Frank & Clara', ARRAY[6,3], ARRAY[5], NOW() - INTERVAL '14 days'),
  (5, false, 14, 14, 21, 'Alice & Emma',  'Frank & Clara', ARRAY[6,3], ARRAY[1], NOW() - INTERVAL '14 days'),
  (6, true,  21, 21, 14, 'Frank & Clara', 'Alice & Emma',  ARRAY[1,5], ARRAY[3], NOW() - INTERVAL '14 days'),
  (3, true,  21, 21, 14, 'Frank & Clara', 'Alice & Emma',  ARRAY[1,5], ARRAY[6], NOW() - INTERVAL '14 days');

-- Game 5: Alice & Clara vs Dave & Frank  →  Alice wins 21-19
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (1, true,  21, 21, 19, 'Alice & Clara', 'Dave & Frank', ARRAY[4,6], ARRAY[3], NOW() - INTERVAL '14 days' + INTERVAL '30 minutes'),
  (3, true,  21, 21, 19, 'Alice & Clara', 'Dave & Frank', ARRAY[4,6], ARRAY[1], NOW() - INTERVAL '14 days' + INTERVAL '30 minutes'),
  (4, false, 19, 19, 21, 'Dave & Frank',  'Alice & Clara', ARRAY[1,3], ARRAY[6], NOW() - INTERVAL '14 days' + INTERVAL '30 minutes'),
  (6, false, 19, 19, 21, 'Dave & Frank',  'Alice & Clara', ARRAY[1,3], ARRAY[4], NOW() - INTERVAL '14 days' + INTERVAL '30 minutes');

-- Game 6: Ben & Frank vs Clara & Dave  →  Frank wins 21-16
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (2, true,  21, 21, 16, 'Ben & Frank',  'Clara & Dave', ARRAY[3,4], ARRAY[6], NOW() - INTERVAL '14 days' + INTERVAL '60 minutes'),
  (6, true,  21, 21, 16, 'Ben & Frank',  'Clara & Dave', ARRAY[3,4], ARRAY[2], NOW() - INTERVAL '14 days' + INTERVAL '60 minutes'),
  (3, false, 16, 16, 21, 'Clara & Dave', 'Ben & Frank',  ARRAY[2,6], ARRAY[4], NOW() - INTERVAL '14 days' + INTERVAL '60 minutes'),
  (4, false, 16, 16, 21, 'Clara & Dave', 'Ben & Frank',  ARRAY[2,6], ARRAY[3], NOW() - INTERVAL '14 days' + INTERVAL '60 minutes');


-- ─── Club Night 3 (last week) ────────────────────────────────

-- Game 7: Alice & Ben vs Frank & Dave  →  Frank wins 21-17
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (1, false, 17, 17, 21, 'Alice & Ben',  'Frank & Dave', ARRAY[6,4], ARRAY[2], NOW() - INTERVAL '7 days'),
  (2, false, 17, 17, 21, 'Alice & Ben',  'Frank & Dave', ARRAY[6,4], ARRAY[1], NOW() - INTERVAL '7 days'),
  (6, true,  21, 21, 17, 'Frank & Dave', 'Alice & Ben',  ARRAY[1,2], ARRAY[4], NOW() - INTERVAL '7 days'),
  (4, true,  21, 21, 17, 'Frank & Dave', 'Alice & Ben',  ARRAY[1,2], ARRAY[6], NOW() - INTERVAL '7 days');

-- Game 8: Alice & Clara vs Emma & Dave  →  Alice wins 21-13
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (1, true,  21, 21, 13, 'Alice & Clara', 'Emma & Dave', ARRAY[5,4], ARRAY[3], NOW() - INTERVAL '7 days' + INTERVAL '30 minutes'),
  (3, true,  21, 21, 13, 'Alice & Clara', 'Emma & Dave', ARRAY[5,4], ARRAY[1], NOW() - INTERVAL '7 days' + INTERVAL '30 minutes'),
  (5, false, 13, 13, 21, 'Emma & Dave',   'Alice & Clara', ARRAY[1,3], ARRAY[4], NOW() - INTERVAL '7 days' + INTERVAL '30 minutes'),
  (4, false, 13, 13, 21, 'Emma & Dave',   'Alice & Clara', ARRAY[1,3], ARRAY[5], NOW() - INTERVAL '7 days' + INTERVAL '30 minutes');

-- Game 9: Frank & Clara vs Ben & Emma  →  Frank wins 21-10
INSERT INTO player_game_history
  (player_id, win, points, score_for, score_against, team_label, opponent_label, opponent_player_ids, teammate_player_ids, played_at)
VALUES
  (6, true,  21, 21, 10, 'Frank & Clara', 'Ben & Emma', ARRAY[2,5], ARRAY[3], NOW() - INTERVAL '7 days' + INTERVAL '60 minutes'),
  (3, true,  21, 21, 10, 'Frank & Clara', 'Ben & Emma', ARRAY[2,5], ARRAY[6], NOW() - INTERVAL '7 days' + INTERVAL '60 minutes'),
  (2, false, 10, 10, 21, 'Ben & Emma',    'Frank & Clara', ARRAY[6,3], ARRAY[5], NOW() - INTERVAL '7 days' + INTERVAL '60 minutes'),
  (5, false, 10, 10, 21, 'Ben & Emma',    'Frank & Clara', ARRAY[6,3], ARRAY[2], NOW() - INTERVAL '7 days' + INTERVAL '60 minutes');


-- ── 4. Update player win/loss/points totals ───────────────────
--  Recalculate from the history we just inserted
UPDATE players p SET
  wins         = sub.wins,
  losses       = sub.losses,
  total_points = sub.total_points
FROM (
  SELECT
    player_id,
    COUNT(*) FILTER (WHERE win = true)  AS wins,
    COUNT(*) FILTER (WHERE win = false) AS losses,
    SUM(points)                          AS total_points
  FROM player_game_history
  GROUP BY player_id
) sub
WHERE p.id = sub.player_id;


-- ── 5. Score history (for courts tab recent results) ─────────
INSERT INTO score_history (court_id, team1_label, team2_label, score1, score2, recorded_at) VALUES
  (1, 'Alice & Clara', 'Ben & Dave',   21, 15, NOW() - INTERVAL '21 days'),
  (1, 'Alice & Dave',  'Clara & Ben',  18, 21, NOW() - INTERVAL '21 days' + INTERVAL '30 minutes'),
  (2, 'Frank & Emma',  'Alice & Ben',  21, 11, NOW() - INTERVAL '21 days' + INTERVAL '60 minutes'),
  (1, 'Alice & Emma',  'Frank & Clara',14, 21, NOW() - INTERVAL '14 days'),
  (1, 'Alice & Clara', 'Dave & Frank', 21, 19, NOW() - INTERVAL '14 days' + INTERVAL '30 minutes'),
  (2, 'Ben & Frank',   'Clara & Dave', 21, 16, NOW() - INTERVAL '14 days' + INTERVAL '60 minutes'),
  (1, 'Alice & Ben',   'Frank & Dave', 17, 21, NOW() - INTERVAL '7 days'),
  (1, 'Alice & Clara', 'Emma & Dave',  21, 13, NOW() - INTERVAL '7 days' + INTERVAL '30 minutes'),
  (2, 'Frank & Clara', 'Ben & Emma',   21, 10, NOW() - INTERVAL '7 days' + INTERVAL '60 minutes');


-- ── What this data gives you on Alice's history page ─────────
--
--  CHARTS
--    Wins & Losses : data points across 3 dates (3 weeks ago,
--                    2 weeks ago, last week)
--    Avg Pts/Day   : varies per session (Alice scores 21,18,11
--                    / 14,21 / 17,21 across the 3 nights)
--
--  PARTNERS (most teamed with)
--    1. Clara  — teamed 3 times
--    2. Ben    — teamed 2 times
--    3. Dave   — teamed 1 time
--
--  RIVALS (fewest wins against)
--    1. Frank  — faced 3 times, 0 wins
--    2. Others with low win counts
--
--  GHOSTED (fewest games as opponent)
--    Emma appears least as Alice's opponent (only 1 game)
--
--  COMPLETE HISTORY
--    9 games total, mix of W and L with scores and dates