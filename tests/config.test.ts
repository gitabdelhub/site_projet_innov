import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vercel.json', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const route = new RegExp(`^${config.rewrites[0].source}$`);

  it('sends app pages to the single-page app', () => {
    for (const page of ['/', '/game', '/coach/elo', '/leaderboard']) expect(route.test(page), page).toBe(true);
  });

  it('leaves the server function and the engine files alone', () => {
    for (const path of ['/api/move', '/assets/index.js', '/stockfish-18-lite-single.wasm', '/chess-icon.svg']) {
      expect(route.test(path), path).toBe(false);
    }
  });
});
