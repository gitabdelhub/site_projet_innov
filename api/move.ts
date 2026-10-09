import { createClient } from '@supabase/supabase-js';
import { checkMove, type StoredGame } from '../server/onlineMove.js';

// POST /api/move  { gameId, from, to, promotion? }  with the player's Supabase token.
// The browser cannot write games any more: this function checks the move with
// chess.js, then the database applies it together with the clock (apply_move).

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json(500, { error: 'Server is not configured (SUPABASE_SERVICE_ROLE_KEY missing).' });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Sign in to play.' });

  let body: { gameId?: unknown; from?: unknown; to?: unknown; promotion?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Invalid request.' });
  }
  const { gameId, from, to, promotion } = body;
  if (typeof gameId !== 'string' || typeof from !== 'string' || typeof to !== 'string' ||
      (promotion !== undefined && promotion !== null && typeof promotion !== 'string')) {
    return json(400, { error: 'Invalid request.' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: 'Your session has expired. Sign in again.' });

  const { data: game, error: gameError } = await admin
    .from('games')
    .select('id, status, fen, pgn, ply, white_player_id, black_player_id')
    .eq('id', gameId)
    .maybeSingle();
  if (gameError) return json(500, { error: 'Database error.' });
  if (!game) return json(404, { error: 'Game not found.' });

  const check = checkMove(game as StoredGame, auth.user.id, { from, to, promotion: promotion ?? undefined });
  if (!check.ok) return json(check.status, { error: check.error });

  const { data: outcome, error: applyError } = await admin.rpc('apply_move', {
    p_game_id: game.id,
    p_player: auth.user.id,
    p_expected_ply: game.ply,
    p_fen: check.fen,
    p_pgn: check.pgn,
    p_result: check.result,
    p_reason: check.reason,
  });
  if (applyError) return json(500, { error: 'The move could not be saved.' });
  if (outcome === 'flagged') return json(409, { error: 'Your time ran out.' });
  if (outcome === 'stale') return json(409, { error: 'The position changed. Reloading the game.' });
  return json(200, { ok: true, result: check.result, reason: check.reason });
}
