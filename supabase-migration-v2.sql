-- =========================================================================
-- Chess Hub — migration v2 (run once in the Supabase SQL editor, after
-- supabase-setup.sql). Safe to run again.
--
-- 1. Players can no longer edit their own rating or stats.
-- 2. Moves can only be written by the player whose turn it is.
-- 3. Game results and Elo changes are applied server-side by finish_game().
-- =========================================================================

-- Reason the game ended (checkmate, resignation, stalemate, ...)
ALTER TABLE games ADD COLUMN IF NOT EXISTS end_reason TEXT;

-- 1. Profiles: only the username is editable by its owner
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (username) ON profiles TO authenticated;

-- 2. Games: clients may only write the position, never the status/winner
REVOKE UPDATE ON games FROM anon, authenticated;
GRANT UPDATE (fen, pgn, updated_at) ON games TO authenticated;

DROP POLICY IF EXISTS "Players can update games" ON games;
CREATE POLICY "Players can update games"
  ON games FOR UPDATE
  USING ((auth.uid() = white_player_id OR auth.uid() = black_player_id) AND status = 'playing');

-- Only the side to move (read from the current FEN) may write the next position
CREATE OR REPLACE FUNCTION public.check_move_turn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fen IS DISTINCT FROM OLD.fen AND auth.uid() IS NOT NULL THEN
    IF split_part(OLD.fen, ' ', 2) = 'w' AND auth.uid() <> OLD.white_player_id THEN
      RAISE EXCEPTION 'It is White''s turn';
    END IF;
    IF split_part(OLD.fen, ' ', 2) = 'b' AND auth.uid() <> OLD.black_player_id THEN
      RAISE EXCEPTION 'It is Black''s turn';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_move_turn ON games;
CREATE TRIGGER check_move_turn
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION public.check_move_turn();

-- 3. End a game and update both ratings atomically.
--    p_result: 'white' | 'black' | 'draw'
--    p_reason: 'checkmate' | 'resignation' | 'stalemate' | 'threefold' | 'insufficient' | 'fifty-moves'
CREATE OR REPLACE FUNCTION public.finish_game(p_game_id UUID, p_result TEXT, p_reason TEXT)
RETURNS VOID AS $$
DECLARE
  g games%ROWTYPE;
  w profiles%ROWTYPE;
  b profiles%ROWTYPE;
  expected_white FLOAT;
  score_white FLOAT;
  k CONSTANT INTEGER := 32;
BEGIN
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF auth.uid() IS DISTINCT FROM g.white_player_id AND auth.uid() IS DISTINCT FROM g.black_player_id THEN
    RAISE EXCEPTION 'Only players can finish this game';
  END IF;
  IF g.status <> 'playing' THEN RETURN; END IF; -- already finished (both clients may call)
  IF p_result NOT IN ('white', 'black', 'draw') THEN RAISE EXCEPTION 'Invalid result'; END IF;

  -- A player can only resign for themselves
  IF p_reason = 'resignation' AND NOT (
    (p_result = 'white' AND auth.uid() = g.black_player_id) OR
    (p_result = 'black' AND auth.uid() = g.white_player_id)
  ) THEN
    RAISE EXCEPTION 'You can only resign your own game';
  END IF;

  SELECT * INTO w FROM profiles WHERE id = g.white_player_id FOR UPDATE;
  SELECT * INTO b FROM profiles WHERE id = g.black_player_id FOR UPDATE;

  expected_white := 1.0 / (1.0 + power(10, (b.elo_rating - w.elo_rating) / 400.0));
  score_white := CASE p_result WHEN 'white' THEN 1.0 WHEN 'black' THEN 0.0 ELSE 0.5 END;

  UPDATE profiles SET
    elo_rating = round(w.elo_rating + k * (score_white - expected_white)),
    games_played = games_played + 1,
    wins = wins + (score_white = 1.0)::INT,
    losses = losses + (score_white = 0.0)::INT,
    draws = draws + (score_white = 0.5)::INT
  WHERE id = w.id;

  UPDATE profiles SET
    elo_rating = round(b.elo_rating + k * ((1.0 - score_white) - (1.0 - expected_white))),
    games_played = games_played + 1,
    wins = wins + (score_white = 0.0)::INT,
    losses = losses + (score_white = 1.0)::INT,
    draws = draws + (score_white = 0.5)::INT
  WHERE id = b.id;

  UPDATE games SET
    status = 'completed',
    winner = CASE p_result WHEN 'white' THEN g.white_player_id WHEN 'black' THEN g.black_player_id ELSE NULL END,
    end_reason = p_reason
  WHERE id = g.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.finish_game(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_game(UUID, TEXT, TEXT) TO authenticated;
