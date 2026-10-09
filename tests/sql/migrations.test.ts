// Runs the three SQL scripts in a real PostgreSQL (PGlite, in memory) set up
// like Supabase (roles, auth.uid(), default privileges), then plays two players
// against the database and tries the cheats the migration must block.
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { Chess } from 'chess.js';

const db = new PGlite();
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';

// Same environment as a Supabase project
const SUPABASE_LIKE = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
  CREATE FUNCTION uuid_generate_v4() RETURNS UUID LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
  CREATE PUBLICATION supabase_realtime;
`;

const script = (file: string) =>
  readFileSync(file, 'utf8').replace(/CREATE EXTENSION[^;]*;/g, '');

// Run SQL as a Supabase role and user (like a request from the browser or the server)
const as = async (role: 'anon' | 'authenticated' | 'service_role', user: string | null, sql: string, params: unknown[] = []) => {
  await db.exec(`SET ROLE ${role}; SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false);`);
  try {
    return await db.query<Record<string, any>>(sql, params);
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`);
  }
};
const fails = async (p: Promise<unknown>) => expect(p).rejects.toThrow();

const game = async (id: string) => (await db.query<Record<string, any>>('SELECT * FROM games WHERE id = $1', [id])).rows[0];
const elo = async (id: string) => (await db.query<{ elo_rating: number }>('SELECT elo_rating FROM profiles WHERE id = $1', [id])).rows[0].elo_rating;

// What /api/move does after checking the move with chess.js
const serverMove = async (gameId: string, player: string, san: string) => {
  const g = await game(gameId);
  const chess = new Chess();
  if (g.pgn) chess.loadPgn(g.pgn);
  chess.move(san);
  const end = chess.isCheckmate() ? (chess.turn() === 'w' ? 'black' : 'white') : null;
  const res = await as('service_role', null, 'SELECT apply_move($1, $2, $3, $4, $5, $6, $7) AS r',
    [gameId, player, g.ply, chess.fen(), chess.pgn(), end, end ? 'checkmate' : null]);
  return res.rows[0].r as string;
};

let gid = '';

beforeAll(async () => {
  await db.exec(SUPABASE_LIKE);
  await db.exec(script('supabase-setup.sql'));
  await db.exec(script('supabase-migration-v2.sql'));
  await db.exec(script('supabase-migration-v3.sql'));
  await db.exec(`
    INSERT INTO auth.users VALUES ('${A}', 'alice@example.com', '{"username":"alice"}');
    INSERT INTO auth.users VALUES ('${B}', 'bob@example.com', '{"username":"bob"}');
    INSERT INTO auth.users VALUES ('${C}', 'carol.x@example.com', '{"username":"alice"}');
  `);
}, 60000);

describe('database security (migration v3)', () => {
  it('runs all three scripts and creates profiles on sign-up, even with a taken name', async () => {
    const names = (await db.query<{ username: string }>('SELECT username FROM profiles ORDER BY email')).rows.map((r) => r.username);
    expect(names[0]).toBe('alice');
    expect(names[1]).toBe('bob');
    expect(names[2]).toMatch(/^alice\d+$/);
  });

  it('keeps e-mail addresses private but the leaderboard public', async () => {
    await fails(as('authenticated', A, 'SELECT email FROM profiles'));
    await fails(as('anon', null, 'SELECT * FROM profiles'));
    const board = await as('anon', null, 'SELECT username, elo_rating FROM profiles ORDER BY elo_rating DESC');
    expect(board.rows).toHaveLength(3);
  });

  it('pairs two players through the queue, once', async () => {
    expect((await as('authenticated', A, 'SELECT join_queue() AS g')).rows[0].g).toBeNull();
    gid = (await as('authenticated', B, 'SELECT join_queue() AS g')).rows[0].g;
    expect(gid).toBeTruthy();
    expect((await as('authenticated', A, 'SELECT join_queue() AS g')).rows[0].g).toBe(gid);
    expect((await db.query('SELECT * FROM games')).rows).toHaveLength(1);
  });

  it('refuses every direct write from the browser', async () => {
    await fails(as('authenticated', A, `UPDATE games SET status = 'completed', winner = '${A}'`));
    await fails(as('authenticated', A, `UPDATE games SET fen = 'k7/8/8/8/8/8/8/K7 w - - 0 1'`));
    await fails(as('authenticated', A, `INSERT INTO games (white_player_id, black_player_id, white_player_username, black_player_username, status) VALUES ('${A}', '${C}', 'a', 'c', 'playing')`));
    await fails(as('authenticated', A, `UPDATE profiles SET elo_rating = 3000 WHERE id = '${A}'`));
    await fails(as('authenticated', A, `SELECT finish_game_internal('${gid}', 'white', 'checkmate')`));
    await fails(as('authenticated', A, `SELECT apply_move('${gid}', '${A}', 0, 'x', 'x', 'white', 'checkmate')`));
  });

  it('hides a game from players who are not in it', async () => {
    expect((await as('authenticated', C, 'SELECT * FROM games')).rows).toHaveLength(0);
  });

  it('applies server moves only for the side to move, and rejects stale ones', async () => {
    const g = await game(gid);
    const white = g.white_player_id;
    const black = g.black_player_id;
    await fails(serverMove(gid, black, 'e4'));
    expect(await serverMove(gid, white, 'e4')).toBe('ok');
    const stale = await as('service_role', null, 'SELECT apply_move($1, $2, 0, $3, $4, NULL, NULL) AS r', [gid, black, 'x', 'x']);
    expect(stale.rows[0].r).toBe('stale');
    expect((await game(gid)).ply).toBe(1);
  });

  it('only lets players chat, and shows their real name', async () => {
    await as('authenticated', A, `INSERT INTO messages (game_id, user_id, content) VALUES ('${gid}', '${A}', 'hello')`);
    await fails(as('authenticated', A, `INSERT INTO messages (game_id, user_id, username, content) VALUES ('${gid}', '${A}', 'bob', 'fake')`));
    await fails(as('authenticated', C, `INSERT INTO messages (game_id, user_id, content) VALUES ('${gid}', '${C}', 'spam')`));
    await fails(as('authenticated', A, `INSERT INTO messages (game_id, user_id, content) VALUES ('${gid}', '${A}', '${'x'.repeat(501)}')`));
    const msgs = (await db.query<{ username: string }>('SELECT username FROM messages')).rows;
    expect(msgs).toEqual([{ username: 'alice' }]);
  });

  it('ends the game on checkmate and moves both ratings', async () => {
    const g = await game(gid);
    const [white, black] = [g.white_player_id, g.black_player_id];
    for (const [player, san] of [[black, 'e5'], [white, 'Bc4'], [black, 'Nc6'], [white, 'Qh5'], [black, 'Nf6'], [white, 'Qxf7#']] as const) {
      expect(await serverMove(gid, player, san)).toBe('ok');
    }
    const done = await game(gid);
    expect(done.status).toBe('completed');
    expect(done.winner).toBe(white);
    expect(await elo(white)).toBe(1216);
    expect(await elo(black)).toBe(1184);
    await fails(serverMove(gid, black, 'Ke7'));
  });

  it('lets a player resign only their own game', async () => {
    const g2 = (await db.query<{ id: string }>(`INSERT INTO games (white_player_id, black_player_id, white_player_username, black_player_username, status)
      VALUES ('${A}', '${B}', 'alice', 'bob', 'playing') RETURNING id`)).rows[0].id;
    await fails(as('authenticated', C, `SELECT resign_game('${g2}')`));
    await as('authenticated', B, `SELECT resign_game('${g2}')`);
    expect((await game(g2)).winner).toBe(A);
  });

  it('decides time-outs with the database clock', async () => {
    const g3 = (await db.query<{ id: string }>(`INSERT INTO games (white_player_id, black_player_id, white_player_username, black_player_username, status, white_ms, black_ms)
      VALUES ('${A}', '${B}', 'alice', 'bob', 'playing', 60000, 60000) RETURNING id`)).rows[0].id;
    expect((await as('authenticated', B, `SELECT claim_timeout('${g3}') AS t`)).rows[0].t).toBe(false);
    await db.query(`UPDATE games SET turn_started_at = NOW() - INTERVAL '61 seconds' WHERE id = $1`, [g3]);
    expect((await as('authenticated', B, `SELECT claim_timeout('${g3}') AS t`)).rows[0].t).toBe(true);
    const g = await game(g3);
    expect(g.end_reason).toBe('timeout');
    expect(g.winner).toBe(B);
  });

  it('cancels a game nobody started without touching ratings', async () => {
    const before = await elo(A);
    const g4 = (await db.query<{ id: string }>(`INSERT INTO games (white_player_id, black_player_id, white_player_username, black_player_username, status, turn_started_at)
      VALUES ('${A}', '${B}', 'alice', 'bob', 'playing', NOW() - INTERVAL '40 seconds') RETURNING id`)).rows[0].id;
    expect((await as('authenticated', B, `SELECT abort_game('${g4}') AS a`)).rows[0].a).toBe(true);
    expect((await game(g4)).status).toBe('aborted');
    expect(await elo(A)).toBe(before);
  });

  it('checks new user names but never blocks older accounts', async () => {
    await fails(as('authenticated', A, `UPDATE profiles SET username = 'x' WHERE id = '${A}'`));
    await as('authenticated', A, `UPDATE profiles SET username = 'alice_2' WHERE id = '${A}'`);
    // A name created before v3 (the rule did not exist yet): skip triggers to simulate it
    await db.exec(`SET session_replication_role = replica; UPDATE profiles SET username = 'old.name' WHERE id = '${C}'; SET session_replication_role = origin;`);
    await db.query(`UPDATE profiles SET elo_rating = elo_rating + 1 WHERE id = '${C}'`);
  });
});
