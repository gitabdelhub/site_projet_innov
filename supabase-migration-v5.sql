-- =========================================================================
-- Chess Hub — migration v5: playing and learning together
-- Run once in the Supabase SQL editor, after v4. Safe to run again.
-- It ADDS tables and functions; ranked games keep working exactly as before.
--
--   * Friend challenge by link or code (casual or "training" game, no rating change)
--   * Puzzle duel: two players race on the same puzzles
--   * Study room: a shared board that every member can move
--   * A daily limit for the AI teacher (/api/coach)
--
-- As in v3, the browser never writes these tables directly: every change goes
-- through a function below, which checks who is calling.
-- =========================================================================

-- ---------- 1. Unrated games ----------------------------------------------
ALTER TABLE games ADD COLUMN IF NOT EXISTS rated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'ranked';
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_mode_check;
ALTER TABLE games ADD CONSTRAINT games_mode_check CHECK (mode IN ('ranked', 'friend', 'training'));

-- Same as v3, except that an unrated game ends without touching anyone's rating
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

  IF g.rated THEN
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
  END IF;

  UPDATE games SET
    status = 'completed',
    winner = CASE p_result WHEN 'white' THEN g.white_player_id WHEN 'black' THEN g.black_player_id ELSE NULL END,
    end_reason = p_reason
  WHERE id = g.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 2. Short codes shared by invitations, duels and study rooms ---
CREATE TABLE IF NOT EXISTS public.invites (
  code TEXT PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  host_username TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('friend', 'training')),
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 60),
  increment_s INTEGER NOT NULL CHECK (increment_s BETWEEN 0 AND 30),
  host_color TEXT NOT NULL CHECK (host_color IN ('w', 'b', 'random')),
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  host_username TEXT NOT NULL,
  guest_username TEXT,
  puzzle_ids TEXT[] NOT NULL CHECK (array_length(puzzle_ids, 1) BETWEEN 3 AND 10),
  host_step INTEGER NOT NULL DEFAULT 0, -- puzzles answered (solved or not)
  guest_step INTEGER NOT NULL DEFAULT 0,
  host_score INTEGER NOT NULL DEFAULT 0, -- puzzles solved
  guest_score INTEGER NOT NULL DEFAULT 0,
  host_finished_at TIMESTAMPTZ,
  guest_finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_rooms (
  code TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_username TEXT NOT NULL,
  start_fen TEXT NOT NULL CHECK (char_length(start_fen) <= 100),
  moves TEXT[] NOT NULL DEFAULT '{}', -- moves (SAN) played from start_fen
  cursor INTEGER NOT NULL DEFAULT 0, -- how many of them are shown on the board
  version INTEGER NOT NULL DEFAULT 0, -- bumped on every change (refuses stale updates)
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.study_members (
  code TEXT NOT NULL REFERENCES study_rooms(code) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (code, user_id)
);

-- 6 characters without look-alikes (no 0/O, 1/I), unique across the three tables
CREATE OR REPLACE FUNCTION public.new_share_code()
RETURNS TEXT AS $$
DECLARE
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c TEXT;
BEGIN
  LOOP
    c := '';
    FOR i IN 1..6 LOOP
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM invites WHERE code = c)
          AND NOT EXISTS (SELECT 1 FROM duels WHERE code = c)
          AND NOT EXISTS (SELECT 1 FROM study_rooms WHERE code = c);
  END LOOP;
  RETURN c;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

-- What a code points to: 'invite', 'duel', 'study' or NULL
CREATE OR REPLACE FUNCTION public.resolve_code(p_code TEXT)
RETURNS TEXT AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM invites WHERE code = upper(p_code)) THEN 'invite'
    WHEN EXISTS (SELECT 1 FROM duels WHERE code = upper(p_code)) THEN 'duel'
    WHEN EXISTS (SELECT 1 FROM study_rooms WHERE code = upper(p_code)) THEN 'study'
  END;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ---------- 3. Friend challenge -------------------------------------------
-- Creates an invitation (a player keeps at most one open invitation)
CREATE OR REPLACE FUNCTION public.create_invite(p_mode TEXT, p_minutes INTEGER, p_increment INTEGER, p_color TEXT)
RETURNS TEXT AS $$
DECLARE
  me profiles%ROWTYPE;
  c TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  DELETE FROM invites WHERE host_id = me.id AND game_id IS NULL;
  c := public.new_share_code();
  INSERT INTO invites (code, host_id, host_username, mode, minutes, increment_s, host_color)
    VALUES (c, me.id, me.username, p_mode, p_minutes, p_increment, p_color);
  RETURN c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- What the invitation page shows. The game id is only given to the host
-- (the guest gets it from accept_invite).
CREATE OR REPLACE FUNCTION public.invite_info(p_code TEXT)
RETURNS TABLE (host_username TEXT, mode TEXT, minutes INTEGER, increment_s INTEGER, host_color TEXT,
               is_host BOOLEAN, game_id UUID, expired BOOLEAN) AS $$
  SELECT i.host_username, i.mode, i.minutes, i.increment_s, i.host_color,
         i.host_id = auth.uid(),
         CASE WHEN i.host_id = auth.uid() THEN i.game_id END,
         i.created_at < NOW() - INTERVAL '24 hours'
  FROM invites i WHERE i.code = upper(p_code);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- The friend accepts: the game starts at once. Returns the game id.
CREATE OR REPLACE FUNCTION public.accept_invite(p_code TEXT)
RETURNS UUID AS $$
DECLARE
  inv invites%ROWTYPE;
  me profiles%ROWTYPE;
  g games%ROWTYPE;
  host_white BOOLEAN;
  gid UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM invites WHERE code = upper(p_code) FOR UPDATE;
  IF NOT FOUND OR inv.created_at < NOW() - INTERVAL '24 hours' THEN RAISE EXCEPTION 'Invitation not found or expired'; END IF;

  IF inv.game_id IS NOT NULL THEN
    SELECT * INTO g FROM games WHERE id = inv.game_id;
    IF auth.uid() IN (g.white_player_id, g.black_player_id) THEN RETURN g.id; END IF;
    RAISE EXCEPTION 'Invitation already used';
  END IF;
  IF inv.host_id = auth.uid() THEN RAISE EXCEPTION 'You cannot accept your own invitation'; END IF;

  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  host_white := CASE inv.host_color WHEN 'w' THEN TRUE WHEN 'b' THEN FALSE ELSE random() < 0.5 END;

  INSERT INTO games (white_player_id, black_player_id, white_player_username, black_player_username,
                     status, white_ms, black_ms, increment_ms, turn_started_at, rated, mode)
  VALUES (
    CASE WHEN host_white THEN inv.host_id ELSE me.id END,
    CASE WHEN host_white THEN me.id ELSE inv.host_id END,
    CASE WHEN host_white THEN inv.host_username ELSE me.username END,
    CASE WHEN host_white THEN me.username ELSE inv.host_username END,
    'playing', inv.minutes * 60000, inv.minutes * 60000, inv.increment_s * 1000, NOW(), FALSE, inv.mode
  ) RETURNING id INTO gid;

  UPDATE invites SET game_id = gid WHERE code = inv.code;
  RETURN gid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cancel_invite(p_code TEXT)
RETURNS VOID AS $$
  DELETE FROM invites WHERE code = upper(p_code) AND host_id = auth.uid() AND game_id IS NULL;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- ---------- 4. Puzzle duel ------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_duel(p_puzzles TEXT[])
RETURNS TEXT AS $$
DECLARE
  me profiles%ROWTYPE;
  c TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_puzzles) AS p WHERE p !~ '^[A-Za-z0-9_-]{1,20}$') THEN
    RAISE EXCEPTION 'Invalid puzzle id';
  END IF;
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  DELETE FROM duels WHERE host_id = me.id AND status = 'waiting';
  c := public.new_share_code();
  INSERT INTO duels (code, host_id, host_username, puzzle_ids) VALUES (c, me.id, me.username, p_puzzles);
  RETURN c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Join a duel by its code (the host calls it too). The race starts 5 s after the guest arrives.
CREATE OR REPLACE FUNCTION public.join_duel(p_code TEXT)
RETURNS UUID AS $$
DECLARE
  d duels%ROWTYPE;
  me profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO d FROM duels WHERE code = upper(p_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duel not found'; END IF;
  IF auth.uid() IN (d.host_id, d.guest_id) THEN RETURN d.id; END IF;
  IF d.guest_id IS NOT NULL OR d.status <> 'waiting' THEN RAISE EXCEPTION 'This duel already has two players'; END IF;
  IF d.created_at < NOW() - INTERVAL '24 hours' THEN RAISE EXCEPTION 'Duel expired'; END IF;
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  UPDATE duels SET guest_id = me.id, guest_username = me.username, status = 'playing',
                   started_at = NOW() + INTERVAL '5 seconds'
  WHERE id = d.id;
  RETURN d.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- One answer: the player's step must be the next one (no skipping, no double counting)
CREATE OR REPLACE FUNCTION public.duel_answer(p_duel UUID, p_step INTEGER, p_solved BOOLEAN)
RETURNS VOID AS $$
DECLARE
  d duels%ROWTYPE;
  n INTEGER;
  host BOOLEAN;
BEGIN
  SELECT * INTO d FROM duels WHERE id = p_duel FOR UPDATE;
  IF NOT FOUND OR d.status <> 'playing' OR NOW() < d.started_at THEN RETURN; END IF;
  IF auth.uid() = d.host_id THEN host := TRUE;
  ELSIF auth.uid() = d.guest_id THEN host := FALSE;
  ELSE RAISE EXCEPTION 'Only the two players can answer';
  END IF;
  n := array_length(d.puzzle_ids, 1);
  IF p_step <> (CASE WHEN host THEN d.host_step ELSE d.guest_step END) OR p_step >= n THEN RETURN; END IF;

  IF host THEN
    UPDATE duels SET host_step = host_step + 1, host_score = host_score + p_solved::INT,
                     host_finished_at = CASE WHEN p_step + 1 = n THEN NOW() END
    WHERE id = d.id;
  ELSE
    UPDATE duels SET guest_step = guest_step + 1, guest_score = guest_score + p_solved::INT,
                     guest_finished_at = CASE WHEN p_step + 1 = n THEN NOW() END
    WHERE id = d.id;
  END IF;
  UPDATE duels SET status = 'finished' WHERE id = d.id AND host_step = n AND guest_step = n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 5. Study room -------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_study_member(p_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM study_members WHERE code = p_code AND user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.create_study(p_fen TEXT)
RETURNS TEXT AS $$
DECLARE
  me profiles%ROWTYPE;
  c TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_fen !~ '^[1-8pnbrqkPNBRQK/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+$' THEN RAISE EXCEPTION 'Invalid position'; END IF;
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  c := public.new_share_code();
  INSERT INTO study_rooms (code, owner_id, owner_username, start_fen, updated_by) VALUES (c, me.id, me.username, p_fen, me.username);
  INSERT INTO study_members (code, user_id, username) VALUES (c, me.id, me.username);
  RETURN c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Anyone with the code may join (that is what sharing the link means)
CREATE OR REPLACE FUNCTION public.join_study(p_code TEXT)
RETURNS VOID AS $$
DECLARE me profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM study_rooms WHERE code = upper(p_code)) THEN RAISE EXCEPTION 'Study room not found'; END IF;
  SELECT * INTO me FROM profiles WHERE id = auth.uid();
  INSERT INTO study_members (code, user_id, username) VALUES (upper(p_code), me.id, me.username)
    ON CONFLICT (code, user_id) DO UPDATE SET last_seen = NOW(), username = EXCLUDED.username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Change the shared board. Returns the new version, or -1 if someone changed it meanwhile.
CREATE OR REPLACE FUNCTION public.study_update(p_code TEXT, p_moves TEXT[], p_cursor INTEGER, p_version INTEGER)
RETURNS INTEGER AS $$
DECLARE
  r study_rooms%ROWTYPE;
  n INTEGER := COALESCE(array_length(p_moves, 1), 0);
BEGIN
  IF NOT public.is_study_member(upper(p_code)) THEN RAISE EXCEPTION 'Join the study room first'; END IF;
  IF n > 600 OR p_cursor < 0 OR p_cursor > n THEN RAISE EXCEPTION 'Invalid position'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_moves) AS m WHERE m !~ '^[A-Za-z0-9+#=-]{2,8}$') THEN RAISE EXCEPTION 'Invalid move'; END IF;
  SELECT * INTO r FROM study_rooms WHERE code = upper(p_code) FOR UPDATE;
  IF r.version <> p_version THEN RETURN -1; END IF;
  UPDATE study_rooms SET moves = p_moves, cursor = p_cursor, version = version + 1, updated_at = NOW(),
                         updated_by = (SELECT username FROM profiles WHERE id = auth.uid())
  WHERE code = r.code;
  UPDATE study_members SET last_seen = NOW() WHERE code = r.code AND user_id = auth.uid();
  RETURN r.version + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 6. AI teacher: daily limit per player -------------------------
-- Called by /api/coach with the service key. TRUE while the player is under the limit.
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE OR REPLACE FUNCTION public.ai_take_quota(p_user UUID, p_limit INTEGER)
RETURNS BOOLEAN AS $$
DECLARE used INTEGER;
BEGIN
  INSERT INTO ai_usage (user_id, day, count) VALUES (p_user, CURRENT_DATE, 1)
    ON CONFLICT (user_id, day) DO UPDATE SET count = ai_usage.count + 1
    RETURNING count INTO used;
  DELETE FROM ai_usage WHERE day < CURRENT_DATE - 7;
  RETURN used <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ---------- 7. Who may read what ------------------------------------------
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE invites, duels, study_rooms, study_members, ai_usage FROM anon, authenticated;

-- Invitations are only read through invite_info()
GRANT SELECT ON duels, study_rooms, study_members TO authenticated;

DROP POLICY IF EXISTS "Duel players read their duel" ON duels;
CREATE POLICY "Duel players read their duel" ON duels
  FOR SELECT USING (auth.uid() = host_id OR auth.uid() = guest_id);

DROP POLICY IF EXISTS "Members read their study room" ON study_rooms;
CREATE POLICY "Members read their study room" ON study_rooms
  FOR SELECT USING (public.is_study_member(code));

DROP POLICY IF EXISTS "Members see who is in the room" ON study_members;
CREATE POLICY "Members see who is in the room" ON study_members
  FOR SELECT USING (public.is_study_member(code));

-- Live updates for the study board
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE study_rooms;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

REVOKE ALL ON FUNCTION public.new_share_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_take_quota(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_take_quota(UUID, INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_code(TEXT), public.create_invite(TEXT, INTEGER, INTEGER, TEXT),
  public.invite_info(TEXT), public.accept_invite(TEXT), public.cancel_invite(TEXT),
  public.create_duel(TEXT[]), public.join_duel(TEXT), public.duel_answer(UUID, INTEGER, BOOLEAN),
  public.is_study_member(TEXT), public.create_study(TEXT), public.join_study(TEXT),
  public.study_update(TEXT, TEXT[], INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_code(TEXT), public.create_invite(TEXT, INTEGER, INTEGER, TEXT),
  public.invite_info(TEXT), public.accept_invite(TEXT), public.cancel_invite(TEXT),
  public.create_duel(TEXT[]), public.join_duel(TEXT), public.duel_answer(UUID, INTEGER, BOOLEAN),
  public.is_study_member(TEXT), public.create_study(TEXT), public.join_study(TEXT),
  public.study_update(TEXT, TEXT[], INTEGER, INTEGER) TO authenticated;
