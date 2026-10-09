-- =========================================================================
-- Chess Hub — migration v3: cheat-proof online play
-- Run once in the Supabase SQL editor, after supabase-setup.sql and
-- supabase-migration-v2.sql. Safe to run again.
--
-- After this migration the browser can only READ games. Everything that
-- changes a game goes through the server:
--   * join_queue / leave_queue   pair players (server-side ratings, no fake games)
--   * /api/move (Vercel)         checks every move with chess.js, then apply_move()
--   * resign_game                a player can only resign their own game
--   * claim_timeout              the clock is kept by the database, not the browser
--   * abort_game                 cancel a game nobody started (no rating change)
-- Ratings are only changed by finish_game_internal(), which no client can call.
-- E-mail addresses are no longer readable by other users.
-- =========================================================================

-- ---------- 1. New columns ------------------------------------------------
ALTER TABLE games ADD COLUMN IF NOT EXISTS ply INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_ms INTEGER NOT NULL DEFAULT 600000;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_ms INTEGER NOT NULL DEFAULT 600000;
ALTER TABLE games ADD COLUMN IF NOT EXISTS increment_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE matchmaking_queue ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE messages ADD CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 500);

-- New user names: 3-24 letters, digits, _ or - (checked only when the name changes,
-- so older accounts keep working)
CREATE OR REPLACE FUNCTION public.check_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username AND NEW.username !~ '^[A-Za-z0-9_-]{3,24}$' THEN
    RAISE EXCEPTION 'User names use 3 to 24 letters, digits, _ or -';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_username ON profiles;
CREATE TRIGGER check_username BEFORE UPDATE OF username ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_username();

-- ---------- 2. Table permissions ------------------------------------------
REVOKE ALL ON TABLE profiles, games, matchmaking_queue, messages FROM anon, authenticated;

-- Profiles: public columns only (no e-mail); a player may rename themselves
GRANT SELECT (id, username, elo_rating, games_played, wins, losses, draws, created_at, updated_at) ON profiles TO anon, authenticated;
GRANT UPDATE (username) ON profiles TO authenticated;

-- Games: read-only for the two players (RLS policy "Games are viewable by players")
GRANT SELECT ON games TO authenticated;

-- Queue: each player only sees their own entry; joining/leaving goes through functions
GRANT SELECT ON matchmaking_queue TO authenticated;
DROP POLICY IF EXISTS "Queue is viewable by everyone" ON matchmaking_queue;
DROP POLICY IF EXISTS "Users can see their queue entry" ON matchmaking_queue;
CREATE POLICY "Users can see their queue entry" ON matchmaking_queue FOR SELECT USING (auth.uid() = user_id);

-- Chat: players of the game read and write; the name shown is taken from the profile
GRANT SELECT ON messages TO authenticated;
GRANT INSERT (game_id, user_id, content) ON messages TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can create games" ON games;
DROP POLICY IF EXISTS "Players can update games" ON games;
DROP POLICY IF EXISTS "Users can join queue" ON matchmaking_queue;
DROP POLICY IF EXISTS "Users can leave queue" ON matchmaking_queue;

CREATE OR REPLACE FUNCTION public.set_message_username()
RETURNS TRIGGER AS $$
BEGIN
  SELECT username INTO NEW.username FROM profiles WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_message_username ON messages;
CREATE TRIGGER set_message_username BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION public.set_message_username();

-- The v2 turn check is replaced by apply_move()
DROP TRIGGER IF EXISTS check_move_turn ON games;

-- A taken user name no longer makes sign-up fail: a number is added instead
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base TEXT := left(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), '[^A-Za-z0-9_-]', '', 'g'), 20);
  candidate TEXT;
BEGIN
  IF char_length(base) < 3 THEN base := 'player'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = candidate) LOOP
    candidate := base || floor(random() * 10000)::INT;
  END LOOP;
  INSERT INTO public.profiles (id, username, email) VALUES (NEW.id, candidate, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 3. Ending a game (server only) --------------------------------
DROP FUNCTION IF EXISTS public.finish_game(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.finish_game_internal(p_game_id UUID, p_result TEXT, p_reason TEXT)
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
  IF NOT FOUND OR g.status <> 'playing' THEN RETURN; END IF;
  IF p_result NOT IN ('white', 'black', 'draw') THEN RAISE EXCEPTION 'Invalid result'; END IF;

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

-- Milliseconds left for the side to move, according to the database clock
CREATE OR REPLACE FUNCTION public.time_left_ms(g games)
RETURNS INTEGER AS $$
  SELECT (CASE WHEN split_part(g.fen, ' ', 2) = 'w' THEN g.white_ms ELSE g.black_ms END)
         - (EXTRACT(EPOCH FROM (NOW() - g.turn_started_at)) * 1000)::INTEGER;
$$ LANGUAGE sql STABLE;

-- Flag fall: the side to move loses, unless the other side only has its king (draw)
CREATE OR REPLACE FUNCTION public.flag_result(g games)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN split_part(g.fen, ' ', 2) = 'w' THEN
      CASE WHEN split_part(g.fen, ' ', 1) ~ '[pnbrq]' THEN 'black' ELSE 'draw' END
    ELSE
      CASE WHEN split_part(g.fen, ' ', 1) ~ '[PNBRQ]' THEN 'white' ELSE 'draw' END
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ---------- 4. Moves (called by /api/move with the service key) -----------
-- Returns 'ok', 'flagged' (time ran out before the move) or 'stale' (position changed meanwhile)
CREATE OR REPLACE FUNCTION public.apply_move(
  p_game_id UUID, p_player UUID, p_expected_ply INTEGER,
  p_fen TEXT, p_pgn TEXT, p_result TEXT, p_reason TEXT
) RETURNS TEXT AS $$
DECLARE
  g games%ROWTYPE;
  left_ms INTEGER;
  white_to_move BOOLEAN;
BEGIN
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'playing' OR g.ply <> p_expected_ply THEN RETURN 'stale'; END IF;
  white_to_move := split_part(g.fen, ' ', 2) = 'w';
  IF p_player <> (CASE WHEN white_to_move THEN g.white_player_id ELSE g.black_player_id END) THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  left_ms := public.time_left_ms(g);
  IF left_ms <= 0 THEN
    PERFORM public.finish_game_internal(g.id, public.flag_result(g), 'timeout');
    RETURN 'flagged';
  END IF;

  UPDATE games SET
    fen = p_fen,
    pgn = p_pgn,
    ply = g.ply + 1,
    white_ms = CASE WHEN white_to_move THEN left_ms + g.increment_ms ELSE g.white_ms END,
    black_ms = CASE WHEN white_to_move THEN g.black_ms ELSE left_ms + g.increment_ms END,
    turn_started_at = NOW()
  WHERE id = g.id;

  IF p_result IS NOT NULL THEN
    PERFORM public.finish_game_internal(g.id, p_result, p_reason);
  END IF;
  RETURN 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 5. Player actions ---------------------------------------------
CREATE OR REPLACE FUNCTION public.resign_game(p_game_id UUID)
RETURNS VOID AS $$
DECLARE g games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'playing' THEN RETURN; END IF;
  IF auth.uid() = g.white_player_id THEN PERFORM public.finish_game_internal(g.id, 'black', 'resignation');
  ELSIF auth.uid() = g.black_player_id THEN PERFORM public.finish_game_internal(g.id, 'white', 'resignation');
  ELSE RAISE EXCEPTION 'Only players can resign';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Either player may ask; the database decides with its own clock
CREATE OR REPLACE FUNCTION public.claim_timeout(p_game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE g games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'playing' THEN RETURN FALSE; END IF;
  IF auth.uid() IS DISTINCT FROM g.white_player_id AND auth.uid() IS DISTINCT FROM g.black_player_id THEN
    RAISE EXCEPTION 'Only players can claim a timeout';
  END IF;
  IF public.time_left_ms(g) > 0 THEN RETURN FALSE; END IF;
  PERFORM public.finish_game_internal(g.id, public.flag_result(g), 'timeout');
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- A game where a player never made their first move after 30 s can be cancelled
CREATE OR REPLACE FUNCTION public.abort_game(p_game_id UUID)
RETURNS BOOLEAN AS $$
DECLARE g games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR g.status <> 'playing' THEN RETURN FALSE; END IF;
  IF auth.uid() IS DISTINCT FROM g.white_player_id AND auth.uid() IS DISTINCT FROM g.black_player_id THEN
    RAISE EXCEPTION 'Only players can abort';
  END IF;
  IF g.ply >= 2 OR NOW() - g.turn_started_at < INTERVAL '30 seconds' THEN RETURN FALSE; END IF;
  UPDATE games SET status = 'aborted', end_reason = 'aborted' WHERE id = g.id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 6. Matchmaking ------------------------------------------------
-- Call every ~2 s while searching. Returns the game id once paired, else NULL.
-- The rating window grows with waiting time: ±100 at first, up to ±800.
CREATE OR REPLACE FUNCTION public.join_queue()
RETURNS UUID AS $$
DECLARE
  me profiles%ROWTYPE;
  my_since TIMESTAMPTZ;
  opp matchmaking_queue%ROWTYPE;
  gid UUID;
  white_first BOOLEAN := random() < 0.5;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('chess-hub-matchmaking'));

  -- Already playing (reconnect, or the opponent just paired us)
  SELECT id INTO gid FROM games
    WHERE status = 'playing' AND (white_player_id = auth.uid() OR black_player_id = auth.uid())
    ORDER BY created_at DESC LIMIT 1;
  IF gid IS NOT NULL THEN
    DELETE FROM matchmaking_queue WHERE user_id = auth.uid();
    RETURN gid;
  END IF;

  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  INSERT INTO matchmaking_queue (user_id, username, elo_rating, last_seen)
    VALUES (me.id, me.username, me.elo_rating, NOW())
    ON CONFLICT (user_id) DO UPDATE SET elo_rating = EXCLUDED.elo_rating, username = EXCLUDED.username, last_seen = NOW()
    RETURNING created_at INTO my_since;

  SELECT * INTO opp FROM matchmaking_queue q
    WHERE q.user_id <> me.id
      AND q.last_seen > NOW() - INTERVAL '15 seconds'
      AND abs(q.elo_rating - me.elo_rating) <=
          LEAST(800, 100 + 10 * EXTRACT(EPOCH FROM (NOW() - LEAST(q.created_at, my_since))))
    ORDER BY abs(q.elo_rating - me.elo_rating), q.created_at
    LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  INSERT INTO games (white_player_id, black_player_id, white_player_username, black_player_username,
                     status, white_ms, black_ms, increment_ms, turn_started_at)
  VALUES (
    CASE WHEN white_first THEN me.id ELSE opp.user_id END,
    CASE WHEN white_first THEN opp.user_id ELSE me.id END,
    CASE WHEN white_first THEN me.username ELSE opp.username END,
    CASE WHEN white_first THEN opp.username ELSE me.username END,
    'playing', 600000, 600000, 2000, NOW()
  ) RETURNING id INTO gid;

  DELETE FROM matchmaking_queue WHERE user_id IN (me.id, opp.user_id);
  RETURN gid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.leave_queue()
RETURNS VOID AS $$
  DELETE FROM matchmaking_queue WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Lets the browser line its clock up with the database clock
CREATE OR REPLACE FUNCTION public.server_now()
RETURNS TIMESTAMPTZ AS $$ SELECT NOW(); $$ LANGUAGE sql STABLE;

-- ---------- 7. Who may call what -----------------------------------------
REVOKE ALL ON FUNCTION public.finish_game_internal(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_move(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_game_internal(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_move(UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.resign_game(UUID), public.claim_timeout(UUID), public.abort_game(UUID),
  public.join_queue(), public.leave_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resign_game(UUID), public.claim_timeout(UUID), public.abort_game(UUID),
  public.join_queue(), public.leave_queue(), public.server_now() TO authenticated;
