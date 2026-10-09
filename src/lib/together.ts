import { supabase } from './supabase';

// Calls to the database functions of supabase-migration-v5.sql (friend challenge,
// puzzle duel, study room). Each returns { data } or { error } with a message key.

export type CodeKind = 'invite' | 'duel' | 'study';

export interface InviteInfo {
  host_username: string;
  mode: 'friend' | 'training';
  minutes: number;
  increment_s: number;
  host_color: 'w' | 'b' | 'random';
  is_host: boolean;
  game_id: string | null;
  expired: boolean;
}

export interface Duel {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  host_username: string;
  guest_username: string | null;
  puzzle_ids: string[];
  host_step: number;
  guest_step: number;
  host_score: number;
  guest_score: number;
  host_finished_at: string | null;
  guest_finished_at: string | null;
  status: 'waiting' | 'playing' | 'finished';
  started_at: string | null;
}

export interface StudyRoom {
  code: string;
  owner_username: string;
  start_fen: string;
  moves: string[];
  cursor: number;
  version: number;
  updated_by: string | null;
}

type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

// Turn a database error into something we can show (the message keys are in the i18n files)
const explain = (message: string): string => {
  if (/function .* does not exist|Could not find the function|schema cache/i.test(message)) return 'together.errMigration';
  if (/expired|not found/i.test(message)) return 'together.errNotFound';
  if (/already (used|has two)/i.test(message)) return 'together.errTaken';
  if (/own invitation/i.test(message)) return 'together.errOwn';
  if (/Not signed in/i.test(message)) return 'together.errSignIn';
  return 'together.errGeneric';
};

const call = async <T,>(fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(`${fn} failed:`, error.message);
    return { error: explain(error.message) };
  }
  return { data: data as T };
};

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export const resolveCode = (code: string) => call<CodeKind | null>('resolve_code', { p_code: normalizeCode(code) });

// Friend challenge
export const createInvite = (mode: 'friend' | 'training', minutes: number, increment: number, color: 'w' | 'b' | 'random') =>
  call<string>('create_invite', { p_mode: mode, p_minutes: minutes, p_increment: increment, p_color: color });
export const inviteInfo = async (code: string): Promise<Result<InviteInfo | null>> => {
  const res = await call<InviteInfo[]>('invite_info', { p_code: code });
  return res.error !== undefined ? res : { data: res.data[0] ?? null };
};
export const acceptInvite = (code: string) => call<string>('accept_invite', { p_code: code });
export const cancelInvite = (code: string) => call<null>('cancel_invite', { p_code: code });

// Puzzle duel
export const createDuel = (puzzleIds: string[]) => call<string>('create_duel', { p_puzzles: puzzleIds });
export const joinDuel = (code: string) => call<string>('join_duel', { p_code: code });
export const duelAnswer = (duelId: string, step: number, solved: boolean) =>
  call<null>('duel_answer', { p_duel: duelId, p_step: step, p_solved: solved });
export const fetchDuel = async (id: string): Promise<Duel | null> => {
  const { data } = await supabase.from('duels').select('*').eq('id', id).maybeSingle();
  return (data as Duel | null) ?? null;
};

// Study room
export const createStudy = (fen: string) => call<string>('create_study', { p_fen: fen });
export const joinStudy = (code: string) => call<null>('join_study', { p_code: code });
export const studyUpdate = (code: string, moves: string[], cursor: number, version: number) =>
  call<number>('study_update', { p_code: code, p_moves: moves, p_cursor: cursor, p_version: version });
export const fetchStudy = async (code: string): Promise<StudyRoom | null> => {
  const { data } = await supabase.from('study_rooms').select('*').eq('code', code).maybeSingle();
  return (data as StudyRoom | null) ?? null;
};
export const fetchStudyMembers = async (code: string) => {
  const { data } = await supabase.from('study_members').select('username, last_seen').eq('code', code);
  return (data as { username: string; last_seen: string }[] | null) ?? [];
};

export const shareLink = (path: string) => `${window.location.origin}${path}`;
