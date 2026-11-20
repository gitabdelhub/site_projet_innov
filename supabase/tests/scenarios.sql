-- Scenario tests for supabase-setup.sql. Each block raises an exception on failure.
\set ON_ERROR_STOP 1

create or replace function t_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('test.uid', coalesce(uid::text, ''), false);
  execute 'set role authenticated';
end $$;
create or replace function t_root() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('test.uid', '', false);
end $$;
create or replace function t_check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok  %', msg;
end $$;
-- Moves the game clock back in time (simulates a player thinking for `ms`).
create or replace function t_wait(p_game uuid, ms int) returns void language sql as $$
  update online_games set last_move_at = last_move_at - make_interval(secs => ms / 1000.0) where id = p_game
$$;
grant execute on function t_as(uuid), t_root(), t_check(boolean, text) to authenticated;

-- Accounts
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.local', '{"username":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.local', '{"username":"Bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.local', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.local', '{}');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  d uuid := '00000000-0000-0000-0000-00000000000d';
  g online_games;
  gid uuid;
  r record;
  n int;
  failed boolean;
begin
  perform t_check((select count(*) from profiles) = 4, 'a profile is created for each new account');
  perform t_check((select username from profiles where id = c) ~ '^alice[0-9]{4}$', 'duplicate username gets a suffix');
  perform t_check((select username from profiles where id = d) = 'joueur', 'username shorter than 3 characters becomes joueur');
end $$;

-- Direct writes are refused
do $$
declare
  failed boolean := false;
begin
  perform t_as('00000000-0000-0000-0000-00000000000a');
  begin
    insert into online_games (status, initial_ms, white_ms, black_ms) values ('active', 60000, 60000, 60000);
  exception when insufficient_privilege then failed := true;
  end;
  perform t_check(failed, 'a player cannot insert a game directly');
  failed := false;
  begin
    update profiles set elo_rating = 3000;
  exception when insufficient_privilege then failed := true;
  end;
  perform t_check(failed, 'a player cannot change a rating directly');
  perform t_root();
end $$;

-- Quick pairing
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  g1 uuid;
  g2 uuid;
  g3 uuid;
  g online_games;
begin
  perform t_as(a);
  perform t_check(find_match(180000, 2000) is null, 'first seeker waits');
  perform t_check(find_match(180000, 2000) is null, 'polling again keeps waiting');
  perform t_as(c);
  perform t_check(find_match(300000, 0) is null, 'other time control is not paired');
  perform t_as(b);
  g1 := find_match(180000, 2000);
  perform t_check(g1 is not null, 'second seeker with the same time control is paired');
  perform t_as(a);
  g2 := find_match(180000, 2000);
  perform t_check(g2 = g1, 'first seeker receives the same game');
  perform t_root();
  select * into g from online_games where id = g1;
  perform t_check(g.status = 'active' and a in (g.white_id, g.black_id) and b in (g.white_id, g.black_id), 'game is active between both players');
  perform t_check(g.white_ms = 180000 and g.black_ms = 180000 and g.increment_ms = 2000, 'clocks set from the time control');
  perform t_check((select count(*) from online_seeks where user_id in (a, b)) = 0, 'seeks removed');
  perform t_as(a);
  perform t_check(find_match(180000, 2000) = g1, 'a player in a game is sent back to it');
  perform t_check(my_current_game() = g1, 'my_current_game finds the running game');
  perform t_root();
  insert into ids values ('g1', g1);
  -- stale seek is ignored
  update online_seeks set seen_at = now() - interval '30 seconds' where user_id = c;
  perform t_as('00000000-0000-0000-0000-00000000000d');
  g3 := find_match(300000, 0);
  perform t_check(g3 is null, 'a seek not refreshed for 30 s is ignored');
  perform cancel_seek();
  perform t_root();
  perform t_check(not exists (select 1 from online_seeks where user_id = '00000000-0000-0000-0000-00000000000d'), 'cancel_seek removes the seek');
  delete from online_seeks;
end $$;

-- Moves, turn order and clocks
do $$
declare
  gid uuid := (select v from ids where k = 'g1');
  g online_games;
  w uuid;
  bl uuid;
  failed text;
begin
  select * into g from online_games where id = gid;
  w := g.white_id; bl := g.black_id;

  perform t_as(bl);
  begin
    perform play_move(gid, 0, 'e7e5', 'e5', 'x');
    failed := 'no';
  exception when others then failed := sqlerrm;
  end;
  perform t_check(failed = 'not_your_turn', 'black cannot move first');

  perform t_as(w);
  g := play_move(gid, 0, 'e2e4', 'e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  perform t_check(g.ply = 1 and g.moves = array['e2e4'] and g.white_ms = 180000, 'first move does not use the clock');
  begin
    perform play_move(gid, 1, 'd2d4', 'd4', 'x');
    failed := 'no';
  exception when others then failed := sqlerrm;
  end;
  perform t_check(failed = 'not_your_turn', 'white cannot move twice');

  perform t_as(bl);
  begin
    perform play_move(gid, 0, 'e7e5', 'e5', 'x');
    failed := 'no';
  exception when others then failed := sqlerrm;
  end;
  perform t_check(failed = 'stale_position', 'a move sent for an old position is refused');
  begin
    perform play_move(gid, 1, 'e7e5; drop', 'e5', 'x');
    failed := 'no';
  exception when others then failed := sqlerrm;
  end;
  perform t_check(failed = 'bad_move', 'a malformed move is refused');
  g := play_move(gid, 1, 'e7e5', 'e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  perform t_check(g.ply = 2 and g.black_ms = 180000, 'black first move does not use the clock');

  perform t_root();
  perform t_wait(gid, 5000);
  perform t_as(w);
  g := play_move(gid, 2, 'g1f3', 'Nf3', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  perform t_check(g.white_ms between 176900 and 177100, 'white clock: 180 s - 5 s + 2 s increment = ' || g.white_ms);
  perform t_check(g.spent_ms[3] between 4900 and 5100, 'time spent on the move is stored');

  -- draw offer, declined by moving, then accepted
  g := offer_draw(gid);
  perform t_check(g.draw_offer = w, 'white offers a draw');
  perform t_as(bl);
  g := play_move(gid, 3, 'b8c6', 'Nc6', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  perform t_check(g.draw_offer is null, 'moving declines the draw offer');
  g := offer_draw(gid);
  perform t_as(w);
  g := decline_draw(gid);
  perform t_check(g.draw_offer is null and g.status = 'active', 'white declines');
  perform t_as(bl);
  g := offer_draw(gid);
  perform t_as('00000000-0000-0000-0000-00000000000c');
  g := offer_draw(gid);
  perform t_check(g.status = 'active', 'a spectator cannot accept a draw');
  g := resign(gid);
  perform t_check(g.status = 'active', 'a spectator cannot resign');
  perform t_as(w);
  g := offer_draw(gid);
  perform t_check(g.status = 'finished' and g.result = '1/2-1/2' and g.reason = 'agreement', 'draw by agreement');
  perform t_check(g.white_delta = -g.black_delta or abs(g.white_delta + g.black_delta) <= 1, 'equal ratings: rating changes cancel out');
  perform t_root();
  perform t_check((select draws from profiles where id = w) = 1 and (select games_played from profiles where id = bl) = 1, 'statistics updated');
  begin
    perform t_as(w);
    perform play_move(gid, 4, 'f1c4', 'Bc4', 'x');
    failed := 'no';
  exception when others then failed := sqlerrm;
  end;
  perform t_check(failed = 'game_not_active', 'no move after the end');
  perform t_root();
end $$;

-- Rematch
do $$
declare
  gid uuid := (select v from ids where k = 'g1');
  g online_games;
  ng online_games;
  w uuid;
  bl uuid;
begin
  select * into g from online_games where id = gid;
  w := g.white_id; bl := g.black_id;
  perform t_as(w);
  g := offer_rematch(gid);
  perform t_check(g.rematch_offer = w and g.rematch_game is null, 'rematch offered');
  perform t_as(bl);
  g := offer_rematch(gid);
  perform t_check(g.rematch_game is not null, 'rematch accepted');
  perform t_root();
  select * into ng from online_games where id = g.rematch_game;
  perform t_check(ng.white_id = bl and ng.black_id = w and ng.status = 'active', 'colors swapped in the rematch');
  insert into ids values ('g2', ng.id);
end $$;

-- Timeout, resign, rating
do $$
declare
  gid uuid := (select v from ids where k = 'g2');
  g online_games;
  w uuid;
  bl uuid;
  rw int;
  rb int;
begin
  select * into g from online_games where id = gid;
  w := g.white_id; bl := g.black_id;
  perform t_as(w);
  g := play_move(gid, 0, 'd2d4', 'd4', 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1');
  perform t_as(bl);
  g := play_move(gid, 1, 'd7d5', 'd5', 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2');
  perform t_as(w);
  g := claim_timeout(gid);
  perform t_check(g.status = 'active', 'no timeout while time is left');
  perform t_root();
  perform t_wait(gid, 181000);
  select elo_rating into rw from profiles where id = w;
  select elo_rating into rb from profiles where id = bl;
  perform t_as(bl);
  g := claim_timeout(gid);
  perform t_check(g.status = 'finished' and g.result = '0-1' and g.reason = 'timeout' and g.white_ms = 0, 'white loses on time');
  perform t_root();
  perform t_check((select elo_rating from profiles where id = bl) > rb and (select elo_rating from profiles where id = w) < rw, 'winner gains rating, loser loses rating');
end $$;

-- A move sent after the flag fell loses on time
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  g online_games;
  gid uuid;
begin
  perform t_as(a);
  g := create_challenge(60000, 0, 'w', false);
  gid := g.id;
  perform t_check(g.status = 'waiting' and g.white_id = a and g.black_id is null, 'challenge created');
  g := join_challenge(gid);
  perform t_check(g.status = 'waiting', 'the creator cannot join their own challenge');
  perform t_as(b);
  g := join_challenge(gid);
  perform t_check(g.status = 'active' and g.black_id = b and g.black_name = 'Bob', 'friend joins the challenge');
  perform t_as('00000000-0000-0000-0000-00000000000c');
  g := join_challenge(gid);
  perform t_check(g.black_id = b, 'a third player cannot take the seat');
  perform t_as(a);
  g := play_move(gid, 0, 'e2e4', 'e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  perform t_as(b);
  g := play_move(gid, 1, 'e7e5', 'e5', 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  perform t_root();
  perform t_wait(gid, 61000);
  perform t_as(a);
  g := play_move(gid, 2, 'g1f3', 'Nf3', 'x');
  perform t_check(g.status = 'finished' and g.reason = 'timeout' and g.result = '0-1' and g.ply = 2, 'late move is not played, white lost on time');
  perform t_check(g.white_delta is null, 'casual game: no rating change');
  perform t_root();
end $$;

-- Timeout when the winner cannot mate is a draw
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  g online_games;
begin
  perform t_as(a);
  g := create_challenge(60000, 0, 'w', false);
  perform t_as(b);
  g := join_challenge(g.id);
  perform t_root();
  update online_games set ply = 10, fen = '8/8/4k3/8/8/8/3QK3/8 w - - 0 40' where id = g.id;
  perform t_wait(g.id, 61000);
  perform t_as(b);
  g := claim_timeout(g.id);
  perform t_check(g.result = '1/2-1/2' and g.reason = 'timeout', 'white flags but black has a lone king: draw');
  perform t_root();
end $$;

-- Abort, first move delay, checkmate, cancel challenge, chat
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  b uuid := '00000000-0000-0000-0000-00000000000b';
  c uuid := '00000000-0000-0000-0000-00000000000c';
  g online_games;
  failed boolean;
begin
  perform t_as(a);
  g := create_challenge(300000, 3000, 'random', true);
  perform t_check(g.white_id = a or g.black_id = a, 'random color challenge');
  g := abort_game(g.id);
  perform t_check(g.status = 'aborted' and g.reason = 'cancelled', 'creator cancels the challenge');

  g := create_challenge(300000, 0, 'w', true);
  perform t_as(b);
  g := join_challenge(g.id);
  g := abort_game(g.id);
  perform t_check(g.status = 'aborted', 'a player can abort before the first moves');

  perform t_as(a);
  g := create_challenge(300000, 0, 'w', true);
  perform t_as(b);
  g := join_challenge(g.id);
  perform t_root();
  perform t_wait(g.id, 31000);
  perform t_as(b);
  g := claim_timeout(g.id);
  perform t_check(g.status = 'aborted' and g.reason = 'no_first_move', 'game aborted when white does not play within 30 s');

  -- Fool's mate
  perform t_as(a);
  g := create_challenge(300000, 0, 'b', true);
  perform t_as(b);
  g := join_challenge(g.id);
  perform t_check(g.white_id = b, 'challenge with black for the creator');
  g := play_move(g.id, 0, 'f2f3', 'f3', 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1');
  perform t_as(a);
  g := play_move(g.id, 1, 'e7e5', 'e5', 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2');
  perform t_as(b);
  g := play_move(g.id, 2, 'g2g4', 'g4', 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2');
  perform t_as(a);
  g := play_move(g.id, 3, 'd8h4', 'Qh4#', 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', '0-1', 'checkmate');
  perform t_check(g.status = 'finished' and g.result = '0-1' and g.reason = 'checkmate', 'checkmate ends the game');
  perform t_check(g.sans = array['f3', 'e5', 'g4', 'Qh4#'], 'moves stored');

  insert into online_messages (game_id, user_id, username, body) values (g.id, a, 'Alice', 'gg');
  perform t_check((select count(*) from online_messages where game_id = g.id) = 1, 'a player can chat');
  perform t_as(c);
  failed := false;
  begin
    insert into online_messages (game_id, user_id, username, body) values (g.id, c, (select username from profiles where id = c), 'hi');
  exception when insufficient_privilege then failed := true;
  end;
  perform t_check(failed, 'a spectator cannot write in the game chat');
  perform t_check((select count(*) from online_messages where game_id = g.id) = 0, 'a spectator cannot read the game chat');
  perform t_as(b);
  failed := false;
  begin
    insert into online_messages (game_id, user_id, username, body) values (g.id, b, 'Alice', 'fake');
  exception when insufficient_privilege then failed := true;
  end;
  perform t_check(failed, 'a player cannot write under another name');

  perform set_username('Bobby_2');
  perform t_root();
  perform t_check((select username from profiles where id = b) = 'Bobby_2', 'username changed');
  perform t_as(a);
  failed := false;
  begin
    perform set_username('bobby_2');
  exception when others then failed := sqlerrm = 'username_taken';
  end;
  perform t_check(failed, 'usernames are unique regardless of case');
  perform t_root();
end $$;

-- Concurrency: two seekers racing for the same opponent.
do $$
declare
  a uuid := '00000000-0000-0000-0000-00000000000a';
  g online_games;
begin
  perform t_root();
  update online_games set status = 'aborted' where status = 'active';
  perform t_as(a);
  perform find_match(60000, 0);
  perform t_root();
  perform t_check((select count(*) from online_seeks) = 1, 'one seek waiting (race test continues in race.sh)');
end $$;
