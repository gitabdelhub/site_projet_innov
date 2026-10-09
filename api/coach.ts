import { createClient } from '@supabase/supabase-js';
import { buildMessages, type AiKind, type Lang } from '../server/aiPrompts.js';

// POST /api/coach  { kind: 'review' | 'lesson' | 'summary', lang, payload }  with the player's Supabase token.
// The AI teacher: Llama 3.3 on Groq. Signed-in players only, with a daily limit per player
// (ai_take_quota, migration v5) so the free Groq quota cannot be drained by one visitor.

const MODEL = 'llama-3.3-70b-versatile';
const DAILY_LIMIT = 40;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function POST(request: Request): Promise<Response> {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return json(503, { error: 'not-configured' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json(503, { error: 'not-configured' });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'sign-in' });

  let body: { kind?: unknown; lang?: unknown; payload?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'bad-request' });
  }
  const kind = body.kind as AiKind;
  const lang: Lang = body.lang === 'en' ? 'en' : 'fr';
  if (!['review', 'lesson', 'summary'].includes(kind)) return json(400, { error: 'bad-request' });
  const messages = buildMessages(kind, lang, body.payload);
  if (!messages) return json(400, { error: 'bad-request' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  if (authError || !auth.user) return json(401, { error: 'sign-in' });

  const { data: allowed, error: quotaError } = await admin.rpc('ai_take_quota', { p_user: auth.user.id, p_limit: DAILY_LIMIT });
  if (quotaError) console.warn('ai_take_quota unavailable (run supabase-migration-v5.sql):', quotaError.message);
  else if (allowed === false) return json(429, { error: 'quota' });

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.4, max_tokens: 450 }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 429) return json(429, { error: 'busy' });
    if (!res.ok) {
      console.error('Groq error', res.status, (await res.text()).slice(0, 300));
      return json(502, { error: 'ai-down' });
    }
    const data = await res.json();
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) return json(502, { error: 'ai-down' });
    return json(200, { text, model: MODEL });
  } catch (error) {
    console.error('Groq request failed', error);
    return json(502, { error: 'ai-down' });
  }
}
