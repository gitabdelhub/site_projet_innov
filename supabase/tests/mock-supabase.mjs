/**
 * Test double of a Supabase project, for end-to-end tests of the online mode
 * without a real project. It serves the parts of the Supabase HTTP API the site
 * uses and runs every query on a LOCAL Postgres that holds supabase-setup.sql,
 * as the `authenticated` role, so the real functions and RLS policies are tested.
 *
 *   node supabase/tests/mock-supabase.mjs   (https://127.0.0.1:54321, self-signed cert)
 *
 * Not covered: Realtime (the site then falls back to polling) and email confirmation.
 * Environment: PGHOST, PGPORT, PGDATABASE (default chess_test), CERT_DIR (key.pem, cert.pem).
 */
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const DB = process.env.PGDATABASE ?? 'chess_test';
const CERT_DIR = process.env.CERT_DIR ?? '.';
const PORT = Number(process.env.PORT ?? 54321);

const psql = (sql) =>
  execFileSync('psql', ['-qtA', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', DB], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

const lit = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`bad identifier ${s}`);
  return s;
};

/** Runs `sql` as the given user (or anon) and returns the parsed JSON of the last line. */
const asUser = (uid, sql) => {
  const out = psql(
    `set test.uid = ${lit(uid ?? '')};\nset role ${uid ? 'authenticated' : 'anon'};\n${sql}`,
  );
  const lines = out.trim().split('\n');
  return JSON.parse(lines[lines.length - 1] || 'null');
};

// Function signatures, read once.
const fns = new Map();
for (const line of psql(`select json_build_object('name', p.proname, 'args', coalesce(p.proargnames, '{}'),
    'types', (select coalesce(json_agg(format_type(t, null) order by i), '[]') from unnest(p.proargtypes) with ordinality u(t, i)),
    'set', p.proretset, 'ret', format_type(p.prorettype, null))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname !~ '^(_|t_)'`)
  .trim()
  .split('\n')) {
  if (!line) continue;
  const f = JSON.parse(line);
  fns.set(f.name, f);
}

// Accounts kept in memory (email -> {id, password}), tokens -> user id.
const accounts = new Map();
const tokens = new Map();
for (const line of psql(`select json_build_object('id', id, 'email', email) from auth.users`).trim().split('\n')) {
  if (!line) continue;
  const u = JSON.parse(line);
  accounts.set(u.email, { id: u.id, password: 'password123', meta: {} });
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const session = (email) => {
  const acc = accounts.get(email);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: acc.id, email, role: 'authenticated', aud: 'authenticated', exp })}.sig`;
  tokens.set(token, acc.id);
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: crypto.randomUUID(),
    user: userJson(email),
  };
};
const userJson = (email) => {
  const acc = accounts.get(email);
  return {
    id: acc.id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email' },
    user_metadata: acc.meta,
    created_at: new Date().toISOString(),
  };
};

/** PostgREST filters used by the site: eq, gt, ilike, in, or=(a.eq.x,b.eq.y). */
const filterSql = (col, expr) => {
  const m = expr.match(/^(eq|neq|gt|lt|gte|lte|ilike|in)\.(.*)$/s);
  if (!m) throw new Error(`unsupported filter ${col}=${expr}`);
  const [, op, val] = m;
  const c = ident(col);
  switch (op) {
    case 'eq': return `${c}::text = ${lit(val)}`;
    case 'neq': return `${c}::text <> ${lit(val)}`;
    case 'gt': return `${c} > ${lit(val)}`;
    case 'lt': return `${c} < ${lit(val)}`;
    case 'gte': return `${c} >= ${lit(val)}`;
    case 'lte': return `${c} <= ${lit(val)}`;
    case 'ilike': return `${c} ilike ${lit(val.replace(/\*/g, '%'))}`;
    case 'in': return `${c}::text in (${val.replace(/^\(|\)$/g, '').split(',').map((v) => lit(v.replace(/^"|"$/g, ''))).join(', ')})`;
  }
};

const selectSql = (table, params) => {
  const where = [];
  let order = '';
  let limit = '';
  for (const [k, v] of params) {
    if (k === 'select') continue;
    if (k === 'order') {
      order = 'order by ' + v.split(',').map((p) => {
        const [c, dir] = p.split('.');
        return `${ident(c)} ${dir === 'desc' ? 'desc' : 'asc'}`;
      }).join(', ');
    } else if (k === 'limit') limit = `limit ${Number(v)}`;
    else if (k === 'or') {
      const parts = v.replace(/^\(|\)$/g, '').split(',').map((p) => {
        const i = p.indexOf('.');
        return filterSql(p.slice(0, i), p.slice(i + 1));
      });
      where.push(`(${parts.join(' or ')})`);
    } else where.push(filterSql(k, v));
  }
  return `select coalesce(json_agg(to_json(t)), '[]') from (select * from public.${ident(table)} ${
    where.length ? 'where ' + where.join(' and ') : ''
  } ${order} ${limit}) t;`;
};

const rpcSql = (name, args) => {
  const f = fns.get(name);
  if (!f) throw Object.assign(new Error(`function ${name} not found`), { httpStatus: 404 });
  const call = `public.${ident(name)}(${f.args
    .slice(0, f.types.length)
    .map((a, i) => `${ident(a)} => ${lit(args[a] === undefined ? null : args[a])}::${f.types[i]}`)
    .join(', ')})`;
  if (f.set) return `select coalesce(json_agg(to_json(r)), '[]') from ${call} r;`;
  return `select to_json(${call});`;
};

const readBody = (req) =>
  new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s ? JSON.parse(s) : {}));
  });

const send = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': 'content-range',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const server = https.createServer(
  { key: fs.readFileSync(path.join(CERT_DIR, 'key.pem')), cert: fs.readFileSync(path.join(CERT_DIR, 'cert.pem')) },
  async (req, res) => {
    const url = new URL(req.url, `https://${req.headers.host}`);
    if (req.method === 'OPTIONS') return send(res, 204);
    const bearer = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    const uid = tokens.get(bearer) ?? null;
    try {
      const p = url.pathname;
      if (p === '/auth/v1/signup' && req.method === 'POST') {
        const b = await readBody(req);
        if (accounts.has(b.email)) return send(res, 422, { code: 422, msg: 'User already registered', message: 'User already registered' });
        if (!b.password || b.password.length < 6) return send(res, 422, { msg: 'Password should be at least 6 characters', message: 'Password should be at least 6 characters' });
        const id = crypto.randomUUID();
        psql(`insert into auth.users (id, email, raw_user_meta_data) values (${lit(id)}, ${lit(b.email)}, ${lit(JSON.stringify(b.data ?? {}))}::jsonb);`);
        accounts.set(b.email, { id, password: b.password, meta: b.data ?? {} });
        return send(res, 200, session(b.email));
      }
      if (p === '/auth/v1/token' && req.method === 'POST') {
        const b = await readBody(req);
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const email = [...accounts.entries()].find(([, a]) => a.id === uid)?.[0];
          if (!email) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
          return send(res, 200, session(email));
        }
        const acc = accounts.get(b.email);
        if (!acc || acc.password !== b.password) {
          return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', message: 'Invalid login credentials', code: 'invalid_credentials' });
        }
        return send(res, 200, session(b.email));
      }
      if (p === '/auth/v1/user' && req.method === 'GET') {
        const email = [...accounts.entries()].find(([, a]) => a.id === uid)?.[0];
        if (!email) return send(res, 401, { message: 'invalid token' });
        return send(res, 200, userJson(email));
      }
      if (p === '/auth/v1/logout') {
        tokens.delete(bearer);
        return send(res, 204);
      }
      const rpc = p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc) {
        const args = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams);
        return send(res, 200, asUser(uid, rpcSql(rpc[1], args)));
      }
      const table = p.match(/^\/rest\/v1\/([a-z_]+)$/);
      if (table && req.method === 'GET') return send(res, 200, asUser(uid, selectSql(table[1], url.searchParams)));
      if (table && req.method === 'POST') {
        const b = await readBody(req);
        const rows = Array.isArray(b) ? b : [b];
        for (const r of rows) {
          const cols = Object.keys(r).map(ident);
          asUser(uid, `insert into public.${ident(table[1])} (${cols.join(', ')}) values (${cols.map((c) => lit(r[c])).join(', ')}); select 'null';`);
        }
        return send(res, 201, []);
      }
      return send(res, 404, { message: `not found ${p}` });
    } catch (e) {
      const stderr = String(e.stderr ?? e.message ?? e);
      const m = stderr.match(/ERROR:\s+(.*)/);
      const message = m ? m[1].trim() : stderr;
      const status = e.httpStatus ?? (/permission denied|row-level security/.test(message) ? 403 : 400);
      if (process.env.VERBOSE) console.error(req.method, url.pathname, message);
      return send(res, status, { code: 'P0001', message, details: null, hint: null });
    }
  },
);
server.on('upgrade', (_req, socket) => socket.destroy()); // no Realtime: the site must fall back to polling
server.listen(PORT, '127.0.0.1', () => console.log(`mock Supabase on https://127.0.0.1:${PORT} (db ${DB})`));
