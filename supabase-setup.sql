-- =========================================================================
-- Chess Hub : base de données du mode en ligne (Supabase)
--
-- À exécuter UNE FOIS dans un projet Supabase neuf :
--   Supabase > SQL Editor > New query > coller ce fichier > Run
--
-- Principe : les tables ne sont jamais modifiées directement par le site.
-- Toutes les actions de jeu passent par des fonctions (RPC) qui vérifient
-- le tour, le numéro du coup, la pendule et le résultat côté serveur.
-- Le script peut être relancé sans erreur.
-- =========================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Profils (un par compte). L'email n'est PAS copié ici : la table est publique.
-- -------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  elo_rating integer not null default 1500,
  games_played integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  draws integer not null default 0,
  created_at timestamptz not null default now()
);

-- Ancien schéma : retire la colonne email si elle existe (elle était publique).
alter table public.profiles drop column if exists email;
alter table public.profiles drop column if exists updated_at;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text := coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1), 'joueur');
  candidate text;
  n int := 0;
begin
  base := left(regexp_replace(base, '[^A-Za-z0-9_-]', '', 'g'), 16);
  if char_length(base) < 3 then base := 'joueur'; end if;
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int::text;
    exit when n > 20;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------------------
-- Parties
-- -------------------------------------------------------------------------
create table if not exists public.online_games (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'aborted')),
  white_id uuid references public.profiles(id) on delete set null,
  black_id uuid references public.profiles(id) on delete set null,
  white_name text,
  black_name text,
  white_rating integer,
  black_rating integer,
  white_delta integer,
  black_delta integer,
  created_by uuid references public.profiles(id) on delete set null,
  rated boolean not null default true,
  initial_ms integer not null check (initial_ms between 15000 and 10800000),
  increment_ms integer not null default 0 check (increment_ms between 0 and 180000),
  white_ms integer not null,
  black_ms integer not null,
  start_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves text[] not null default '{}',
  sans text[] not null default '{}',
  spent_ms integer[] not null default '{}',
  ply integer not null default 0,
  last_move_at timestamptz,
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason text,
  draw_offer uuid,
  rematch_offer uuid,
  rematch_game uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists online_games_white on public.online_games (white_id, status);
create index if not exists online_games_black on public.online_games (black_id, status);
create index if not exists online_games_finished on public.online_games (finished_at desc);

-- File d'attente de l'appariement rapide.
create table if not exists public.online_seeks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  initial_ms integer not null,
  increment_ms integer not null,
  rating integer not null,
  game_id uuid,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

-- Discussion pendant la partie.
create table if not exists public.online_messages (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.online_games(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists online_messages_game on public.online_messages (game_id, id);

-- -------------------------------------------------------------------------
-- Droits : lecture publique des profils et des parties (spectateurs),
-- aucune écriture directe sauf son pseudo et ses messages.
-- -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.online_games enable row level security;
alter table public.online_seeks enable row level security;
alter table public.online_messages enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists games_read on public.online_games;
create policy games_read on public.online_games for select using (true);
drop policy if exists seeks_read_own on public.online_seeks;
create policy seeks_read_own on public.online_seeks for select using (auth.uid() = user_id);
drop policy if exists messages_read on public.online_messages;
create policy messages_read on public.online_messages for select using (
  exists (select 1 from public.online_games g where g.id = game_id and auth.uid() in (g.white_id, g.black_id))
);
drop policy if exists messages_write on public.online_messages;
create policy messages_write on public.online_messages for insert with check (
  auth.uid() = user_id
  and username = (select p.username from public.profiles p where p.id = auth.uid())
  and exists (select 1 from public.online_games g where g.id = game_id and auth.uid() in (g.white_id, g.black_id))
);

revoke all on public.profiles, public.online_games, public.online_seeks, public.online_messages from anon, authenticated;
grant select on public.profiles, public.online_games to anon, authenticated;
grant select on public.online_seeks to authenticated;
grant select, insert on public.online_messages to authenticated;

-- -------------------------------------------------------------------------
-- Outils internes
-- -------------------------------------------------------------------------
create or replace function public.server_now_ms()
returns bigint
language sql
stable
as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

create or replace function public._ms_since(t timestamptz)
returns integer
language sql
volatile
as $$ select greatest(0, (extract(epoch from (clock_timestamp() - t)) * 1000)::integer) $$;

-- Vrai si le camp `side` ne peut pas mater (roi seul, ou roi + un fou ou un cavalier).
create or replace function public._cannot_mate(fen text, side text)
returns boolean
language plpgsql
immutable
as $$
declare
  board text := split_part(fen, ' ', 1);
  pieces text;
begin
  if side = 'w' then
    pieces := regexp_replace(board, '[^PNBRQ]', '', 'g');
  else
    pieces := regexp_replace(board, '[^pnbrq]', '', 'g');
  end if;
  return pieces = '' or (char_length(pieces) = 1 and lower(pieces) in ('n', 'b'));
end;
$$;

create or replace function public._plays(g public.online_games, uid uuid)
returns boolean
language sql
immutable
as $$ select uid is not null and (uid = g.white_id or uid = g.black_id) is true $$;

-- Termine une partie et met à jour les classements (Elo, K = 40 pour les 30 premières parties, puis 20).
create or replace function public._finish(g public.online_games, p_result text, p_reason text)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.profiles;
  b public.profiles;
  score_w numeric;
  exp_w numeric;
  kw int;
  kb int;
  dw int := null;
  db int := null;
begin
  if g.status <> 'active' then
    return g;
  end if;
  if g.rated and g.white_id is not null and g.black_id is not null then
    select * into w from profiles where id = g.white_id for update;
    select * into b from profiles where id = g.black_id for update;
    score_w := case p_result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
    exp_w := 1 / (1 + power(10::numeric, (g.black_rating - g.white_rating) / 400.0));
    kw := case when w.games_played < 30 then 40 else 20 end;
    kb := case when b.games_played < 30 then 40 else 20 end;
    dw := round(kw * (score_w - exp_w));
    db := round(kb * ((1 - score_w) - (1 - exp_w)));
    update profiles set
      elo_rating = greatest(100, elo_rating + dw),
      games_played = games_played + 1,
      wins = wins + (score_w = 1)::int,
      losses = losses + (score_w = 0)::int,
      draws = draws + (score_w = 0.5)::int
    where id = g.white_id;
    update profiles set
      elo_rating = greatest(100, elo_rating + db),
      games_played = games_played + 1,
      wins = wins + (score_w = 0)::int,
      losses = losses + (score_w = 1)::int,
      draws = draws + (score_w = 0.5)::int
    where id = g.black_id;
  end if;
  update online_games set
    status = 'finished',
    result = p_result,
    reason = p_reason,
    white_delta = dw,
    black_delta = db,
    draw_offer = null,
    finished_at = now()
  where id = g.id
  returning * into g;
  return g;
end;
$$;

create or replace function public._abort(g public.online_games, p_reason text)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
begin
  update online_games set status = 'aborted', reason = p_reason, draw_offer = null, finished_at = now()
  where id = g.id and status in ('waiting', 'active')
  returning * into g;
  return g;
end;
$$;

create or replace function public._me()
returns public.profiles
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p profiles;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select * into p from profiles where id = auth.uid();
  if p.id is null then
    raise exception 'no_profile';
  end if;
  return p;
end;
$$;

create or replace function public._lock_game(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  g online_games;
begin
  select * into g from online_games where id = p_game for update;
  if g.id is null then
    raise exception 'game_not_found';
  end if;
  return g;
end;
$$;

-- Crée une partie active entre deux joueurs (couleurs déjà choisies).
create or replace function public._start_game(white profiles, black profiles, p_initial int, p_increment int, p_rated boolean, p_creator uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  g online_games;
begin
  insert into online_games (
    status, white_id, black_id, white_name, black_name, white_rating, black_rating,
    created_by, rated, initial_ms, increment_ms, white_ms, black_ms, last_move_at, started_at
  ) values (
    'active', white.id, black.id, white.username, black.username, white.elo_rating, black.elo_rating,
    p_creator, p_rated, p_initial, p_increment, p_initial, p_initial, now(), now()
  ) returning * into g;
  return g;
end;
$$;

-- Délai pour jouer son premier coup, sinon la partie est annulée.
create or replace function public._first_move_ms()
returns integer
language sql
immutable
as $$ select 30000 $$;

-- -------------------------------------------------------------------------
-- Fonctions appelées par le site
-- -------------------------------------------------------------------------

-- Partie en cours du joueur (pour reprendre après un rechargement).
create or replace function public.my_current_game()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from online_games
  where status = 'active' and auth.uid() in (white_id, black_id)
  order by created_at desc limit 1
$$;

-- Appariement rapide. À appeler toutes les 1 à 2 secondes pendant la recherche :
-- renvoie l'id de la partie dès qu'un adversaire est trouvé, sinon null.
create or replace function public.find_match(p_initial_ms int, p_increment_ms int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles := _me();
  mine online_seeks;
  other online_seeks;
  opp profiles;
  g online_games;
  current uuid;
begin
  if p_initial_ms not between 15000 and 10800000 or p_increment_ms not between 0 and 180000 then
    raise exception 'bad_time_control';
  end if;

  current := my_current_game();
  if current is not null then
    delete from online_seeks where user_id = me.id;
    return current;
  end if;

  select * into mine from online_seeks where user_id = me.id for update;
  if mine.game_id is not null then
    delete from online_seeks where user_id = me.id;
    return mine.game_id;
  end if;

  select * into other from online_seeks s
  where s.user_id <> me.id
    and s.initial_ms = p_initial_ms
    and s.increment_ms = p_increment_ms
    and s.game_id is null
    and s.seen_at > now() - interval '8 seconds'
  order by abs(s.rating - me.elo_rating), s.created_at
  limit 1
  for update skip locked;

  if other.user_id is not null then
    select * into opp from profiles where id = other.user_id;
    if random() < 0.5 then
      g := _start_game(me, opp, p_initial_ms, p_increment_ms, true, null);
    else
      g := _start_game(opp, me, p_initial_ms, p_increment_ms, true, null);
    end if;
    update online_seeks set game_id = g.id where user_id = other.user_id;
    delete from online_seeks where user_id = me.id;
    return g.id;
  end if;

  insert into online_seeks (user_id, initial_ms, increment_ms, rating)
  values (me.id, p_initial_ms, p_increment_ms, me.elo_rating)
  on conflict (user_id) do update set
    initial_ms = excluded.initial_ms,
    increment_ms = excluded.increment_ms,
    rating = excluded.rating,
    created_at = case
      when online_seeks.initial_ms = excluded.initial_ms and online_seeks.increment_ms = excluded.increment_ms
      then online_seeks.created_at else now() end,
    seen_at = now();
  return null;
end;
$$;

create or replace function public.cancel_seek()
returns void
language sql
security definer
set search_path = public
as $$ delete from online_seeks where user_id = auth.uid() and game_id is null $$;

-- Nombre de joueurs en recherche par cadence (affiché dans le salon).
create or replace function public.lobby_counts()
returns table (initial_ms int, increment_ms int, players bigint)
language sql
stable
security definer
set search_path = public
as $$
  select initial_ms, increment_ms, count(*) from online_seeks
  where game_id is null and seen_at > now() - interval '8 seconds'
  group by initial_ms, increment_ms
$$;

-- Défi par lien : crée une partie en attente d'un adversaire.
create or replace function public.create_challenge(p_initial_ms int, p_increment_ms int, p_color text, p_rated boolean)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles := _me();
  side text := case when p_color in ('w', 'b') then p_color else (case when random() < 0.5 then 'w' else 'b' end) end;
  g online_games;
begin
  if p_initial_ms not between 15000 and 10800000 or p_increment_ms not between 0 and 180000 then
    raise exception 'bad_time_control';
  end if;
  insert into online_games (
    status, white_id, black_id, white_name, black_name, white_rating, black_rating,
    created_by, rated, initial_ms, increment_ms, white_ms, black_ms
  ) values (
    'waiting',
    case when side = 'w' then me.id end, case when side = 'b' then me.id end,
    case when side = 'w' then me.username end, case when side = 'b' then me.username end,
    case when side = 'w' then me.elo_rating end, case when side = 'b' then me.elo_rating end,
    me.id, coalesce(p_rated, true), p_initial_ms, p_increment_ms, p_initial_ms, p_initial_ms
  ) returning * into g;
  return g;
end;
$$;

create or replace function public.join_challenge(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles := _me();
  g online_games := _lock_game(p_game);
begin
  if g.status <> 'waiting' or me.id = g.created_by then
    return g;
  end if;
  update online_games set
    status = 'active',
    white_id = coalesce(white_id, me.id),
    white_name = coalesce(white_name, me.username),
    white_rating = coalesce(white_rating, me.elo_rating),
    black_id = coalesce(black_id, me.id),
    black_name = coalesce(black_name, me.username),
    black_rating = coalesce(black_rating, me.elo_rating),
    last_move_at = now(),
    started_at = now()
  where id = g.id
  returning * into g;
  return g;
end;
$$;

-- Jouer un coup. p_ply = nombre de demi-coups déjà joués (contrôle de concurrence).
-- p_result / p_reason : renseignés par le site quand le coup termine la partie
-- (mat, pat, matériel insuffisant, triple répétition, 50 coups).
create or replace function public.play_move(
  p_game uuid, p_ply int, p_uci text, p_san text, p_fen text,
  p_result text default null, p_reason text default null
)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
  side text;
  elapsed int;
  left_ms int;
begin
  if g.status <> 'active' then
    raise exception 'game_not_active';
  end if;
  side := case when g.ply % 2 = 0 then split_part(g.start_fen, ' ', 2) else (case when split_part(g.start_fen, ' ', 2) = 'w' then 'b' else 'w' end) end;
  if (side = 'w' and me is distinct from g.white_id) or (side = 'b' and me is distinct from g.black_id) then
    raise exception 'not_your_turn';
  end if;
  if p_ply <> g.ply then
    raise exception 'stale_position';
  end if;
  if p_uci !~ '^[a-h][1-8][a-h][1-8][qrbn]?$' or p_san is null or p_fen is null then
    raise exception 'bad_move';
  end if;

  elapsed := _ms_since(g.last_move_at);
  if g.ply < 2 then
    if elapsed > _first_move_ms() then
      return _abort(g, 'no_first_move');
    end if;
    left_ms := case when side = 'w' then g.white_ms else g.black_ms end;
    elapsed := 0;
  else
    left_ms := (case when side = 'w' then g.white_ms else g.black_ms end) - elapsed;
    if left_ms <= 0 then
      if side = 'w' then
        update online_games set white_ms = 0 where id = g.id returning * into g;
        return _finish(g, case when _cannot_mate(g.fen, 'b') then '1/2-1/2' else '0-1' end, 'timeout');
      else
        update online_games set black_ms = 0 where id = g.id returning * into g;
        return _finish(g, case when _cannot_mate(g.fen, 'w') then '1/2-1/2' else '1-0' end, 'timeout');
      end if;
    end if;
    left_ms := left_ms + g.increment_ms;
  end if;

  update online_games set
    moves = moves || p_uci,
    sans = sans || p_san,
    spent_ms = spent_ms || elapsed,
    fen = p_fen,
    ply = ply + 1,
    white_ms = case when side = 'w' then left_ms else white_ms end,
    black_ms = case when side = 'b' then left_ms else black_ms end,
    last_move_at = now(),
    -- Jouer un coup refuse la proposition de nulle de l'adversaire.
    draw_offer = case when draw_offer = me then draw_offer else null end
  where id = g.id
  returning * into g;

  if p_reason = 'checkmate' then
    return _finish(g, case when side = 'w' then '1-0' else '0-1' end, 'checkmate');
  elsif p_reason in ('stalemate', 'insufficient', 'threefold', 'fifty') then
    return _finish(g, '1/2-1/2', p_reason);
  end if;
  return g;
end;
$$;

create or replace function public.resign(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
begin
  if g.status <> 'active' or not _plays(g, me) then
    return g;
  end if;
  if g.ply < 2 then
    return _abort(g, 'aborted');
  end if;
  return _finish(g, case when me = g.white_id then '0-1' else '1-0' end, 'resign');
end;
$$;

create or replace function public.abort_game(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
begin
  if g.status = 'waiting' and me = g.created_by then
    return _abort(g, 'cancelled');
  end if;
  if g.status = 'active' and g.ply < 2 and _plays(g, me) then
    return _abort(g, 'aborted');
  end if;
  return g;
end;
$$;

-- Proposer la nulle, ou l'accepter si l'adversaire l'a déjà proposée.
create or replace function public.offer_draw(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
begin
  if g.status <> 'active' or not _plays(g, me) or g.ply < 2 then
    return g;
  end if;
  if g.draw_offer is not null and g.draw_offer <> me then
    return _finish(g, '1/2-1/2', 'agreement');
  end if;
  update online_games set draw_offer = me where id = g.id returning * into g;
  return g;
end;
$$;

create or replace function public.decline_draw(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
begin
  if g.status = 'active' and _plays(g, me) and g.draw_offer is not null and g.draw_offer <> me then
    update online_games set draw_offer = null where id = g.id returning * into g;
  end if;
  return g;
end;
$$;

-- Vérifie la pendule côté serveur (appelé par les deux joueurs quand une pendule
-- affiche 0, ou quand le premier coup n'arrive pas). Sans effet si le temps n'est pas écoulé.
create or replace function public.claim_timeout(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
  side text;
  elapsed int;
begin
  if g.status <> 'active' or not _plays(g, me) then
    return g;
  end if;
  side := case when g.ply % 2 = 0 then split_part(g.start_fen, ' ', 2) else (case when split_part(g.start_fen, ' ', 2) = 'w' then 'b' else 'w' end) end;
  elapsed := _ms_since(g.last_move_at);
  if g.ply < 2 then
    if elapsed > _first_move_ms() then
      return _abort(g, 'no_first_move');
    end if;
    return g;
  end if;
  if side = 'w' and g.white_ms - elapsed <= 0 then
    update online_games set white_ms = 0 where id = g.id returning * into g;
    return _finish(g, case when _cannot_mate(g.fen, 'b') then '1/2-1/2' else '0-1' end, 'timeout');
  elsif side = 'b' and g.black_ms - elapsed <= 0 then
    update online_games set black_ms = 0 where id = g.id returning * into g;
    return _finish(g, case when _cannot_mate(g.fen, 'w') then '1/2-1/2' else '1-0' end, 'timeout');
  end if;
  return g;
end;
$$;

-- Revanche : la première demande est enregistrée, la seconde crée la partie (couleurs inversées).
create or replace function public.offer_rematch(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
  w profiles;
  b profiles;
  ng online_games;
begin
  if g.status not in ('finished', 'aborted') or not _plays(g, me) or g.rematch_game is not null then
    return g;
  end if;
  if g.rematch_offer is not null and g.rematch_offer <> me then
    if my_current_game() is not null then
      return g;
    end if;
    select * into w from profiles where id = g.black_id;
    select * into b from profiles where id = g.white_id;
    if w.id is null or b.id is null then
      return g;
    end if;
    ng := _start_game(w, b, g.initial_ms, g.increment_ms, g.rated, me);
    update online_games set rematch_game = ng.id, rematch_offer = null where id = g.id returning * into g;
    return g;
  end if;
  update online_games set rematch_offer = me where id = g.id returning * into g;
  return g;
end;
$$;

create or replace function public.decline_rematch(p_game uuid)
returns public.online_games
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (_me()).id;
  g online_games := _lock_game(p_game);
begin
  if _plays(g, me) and g.rematch_offer is not null then
    update online_games set rematch_offer = null where id = g.id returning * into g;
  end if;
  return g;
end;
$$;

-- Changer son pseudo.
create or replace function public.set_username(p_username text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me profiles := _me();
  clean text := trim(p_username);
begin
  if clean !~ '^[A-Za-z0-9_-]{3,20}$' then
    raise exception 'bad_username';
  end if;
  if exists (select 1 from profiles where lower(username) = lower(clean) and id <> me.id) then
    raise exception 'username_taken';
  end if;
  update profiles set username = clean where id = me.id returning * into me;
  return me;
end;
$$;

-- Seules les fonctions publiques sont appelables par le site.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.server_now_ms(),
  public.my_current_game(),
  public.find_match(int, int),
  public.cancel_seek(),
  public.lobby_counts(),
  public.create_challenge(int, int, text, boolean),
  public.join_challenge(uuid),
  public.play_move(uuid, int, text, text, text, text, text),
  public.resign(uuid),
  public.abort_game(uuid),
  public.offer_draw(uuid),
  public.decline_draw(uuid),
  public.claim_timeout(uuid),
  public.offer_rematch(uuid),
  public.decline_rematch(uuid),
  public.set_username(text)
to authenticated;
grant execute on function public.server_now_ms(), public.lobby_counts() to anon;

-- -------------------------------------------------------------------------
-- Temps réel : le site reçoit chaque coup et chaque message instantanément.
-- -------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.online_games;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.online_messages;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
