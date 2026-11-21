/**
 * End-to-end test of the online mode with two real browsers (Alice and Bob).
 *   SITE=http://localhost:4173 node supabase/tests/e2e-online.mjs
 * The site must be built against a Supabase project (or mock-supabase.mjs) with an empty database.
 * Screenshots go to SHOTS (default ./e2e-shots).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');

const SITE = process.env.SITE ?? 'http://localhost:4173';
const SHOTS = process.env.SHOTS ?? 'e2e-shots';
const PASSWORD = 'password123';
const stamp = Date.now().toString(36);
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
const newPlayer = async (name, viewport = { width: 1280, height: 860 }) => {
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] page error: ${e.message}`));
  return { name, ctx, page };
};

const signUp = async (p, username) => {
  await p.page.goto(`${SITE}/online`);
  await p.page.getByRole('tab', { name: 'Créer un compte' }).click();
  await p.page.getByLabel('Pseudo').fill(username);
  await p.page.getByLabel('Email').fill(`${username.toLowerCase()}@test.local`);
  await p.page.getByLabel('Mot de passe').fill(PASSWORD);
  await p.page.getByRole('button', { name: 'Créer mon compte' }).click();
  await p.page.getByRole('heading', { name: 'Partie rapide' }).waitFor({ timeout: 15000 });
};

const square = (p, sq) => p.page.locator(`[data-square="${sq}"]`);
const move = async (p, from, to) => {
  await square(p, from).click();
  await square(p, to).click();
};
/** Waits until the piece `piece` (e.g. "wP") is on `sq` on this player's board. */
const waitPiece = (p, sq, piece, timeout = 10000) =>
  square(p, sq).locator(`img[alt="${piece.toLowerCase()[0]}${piece[1].toLowerCase()}"]`).waitFor({ timeout });
const myColor = async (p) => {
  await square(p, 'a1').waitFor({ timeout: 10000 });
  // The bottom bar is mine: its king orientation tells the color (a1 at the bottom left for White).
  const a1 = await square(p, 'a1').boundingBox();
  const a8 = await square(p, 'a8').boundingBox();
  return a1.y > a8.y ? 'w' : 'b';
};
const gameId = (p) => p.page.url().split('/online/')[1];

const alice = await newPlayer('alice');
const bob = await newPlayer('bob', { width: 390, height: 844 }); // Bob plays on a phone

// 1. Accounts
await signUp(alice, `Alice${stamp}`.slice(0, 20));
await signUp(bob, `Bob${stamp}`.slice(0, 20));
check(true, 'two accounts created and signed in');
await alice.page.screenshot({ path: `${SHOTS}/1-lobby-desktop.png` });
await bob.page.screenshot({ path: `${SHOTS}/1-lobby-mobile.png`, fullPage: true });

// 2. Quick pairing 3+2
await alice.page.getByRole('button', { name: '3+2 Blitz' }).click();
await alice.page.getByText('Recherche d’un adversaire').waitFor();
await alice.page.screenshot({ path: `${SHOTS}/2-searching.png` });
await bob.page.getByRole('button', { name: '3+2 Blitz' }).click();
await alice.page.waitForURL(/\/online\/[0-9a-f-]{36}$/, { timeout: 15000 });
await bob.page.waitForURL(/\/online\/[0-9a-f-]{36}$/, { timeout: 15000 });
check(gameId(alice) === gameId(bob), 'both players are sent to the same game');
const ca = await myColor(alice);
const cb = await myColor(bob);
check(ca !== cb, `colors split (${ca} / ${cb})`);
const white = ca === 'w' ? alice : bob;
const black = ca === 'w' ? bob : alice;

// 3. Turn order and moves (Fool's mate)
await move(black, 'e7', 'e5');
await black.page.waitForTimeout(500);
check((await square(black, 'e5').locator('img').count()) === 0, 'black cannot move first');
await move(white, 'f2', 'f3');
await waitPiece(black, 'f3', 'wP');
check(true, "white's move reaches black");
await white.page.screenshot({ path: `${SHOTS}/3-game-desktop.png` });
await move(black, 'e7', 'e5');
await waitPiece(white, 'e5', 'bP');
check(true, "black's move reaches white");

// chat
await black.page.getByPlaceholder('Écris un message...').fill('bonne partie !');
await black.page.getByRole('button', { name: 'Envoyer' }).click();
await white.page.getByText('bonne partie !').waitFor({ timeout: 10000 });
check(true, 'chat message delivered');

await move(white, 'g2', 'g4');
await waitPiece(black, 'g4', 'wP');
await black.page.screenshot({ path: `${SHOTS}/3-game-mobile.png`, fullPage: true });
await move(black, 'd8', 'h4');
await white.page.getByText('Défaite').waitFor({ timeout: 10000 });
await black.page.getByText('Victoire !').waitFor({ timeout: 10000 });
check(true, 'checkmate: result shown to both players');
const deltaText = await black.page.getByText(/^Elo \+\d+/).first().textContent();
check(/Elo \+\d+/.test(deltaText ?? ''), `winner sees the rating gain (${deltaText})`);
await white.page.screenshot({ path: `${SHOTS}/4-result-desktop.png` });
await black.page.screenshot({ path: `${SHOTS}/4-result-mobile.png` });

// 4. Rematch with colors swapped
const first = gameId(white);
await white.page.getByRole('button', { name: 'Revanche' }).click();
await black.page.getByText(/propose une revanche/).waitFor({ timeout: 10000 });
await black.page.getByRole('button', { name: 'Accepter' }).click();
await white.page.waitForURL((u) => !u.pathname.endsWith(first), { timeout: 15000 });
await black.page.waitForURL((u) => !u.pathname.endsWith(first), { timeout: 15000 });
check(gameId(white) === gameId(black), 'rematch: both players in the new game');
check((await myColor(white)) === 'b' && (await myColor(black)) === 'w', 'rematch: colors swapped');

// 5. Draw offer, declined then accepted (new white = old black)
const w2 = black;
const b2 = white;
await move(w2, 'e2', 'e4');
await waitPiece(b2, 'e4', 'wP');
await move(b2, 'e7', 'e5');
await waitPiece(w2, 'e5', 'bP');
await w2.page.getByRole('button', { name: 'Proposer nulle' }).click();
await b2.page.getByText(/propose la nulle/).waitFor({ timeout: 10000 });
await b2.page.screenshot({ path: `${SHOTS}/5-draw-offer.png` });
await b2.page.getByRole('button', { name: 'Refuser' }).click();
await w2.page.getByRole('button', { name: 'Proposer nulle' }).waitFor({ timeout: 10000 });
check(true, 'draw offer declined');
await w2.page.getByRole('button', { name: 'Proposer nulle' }).click();
await b2.page.getByText(/propose la nulle/).waitFor({ timeout: 10000 });
await b2.page.getByRole('button', { name: 'Accepter' }).click();
await w2.page.getByText('Partie nulle').waitFor({ timeout: 10000 });
check(true, 'draw by agreement');

// 6. Challenge by link: Alice creates, Bob opens the link and accepts
await alice.page.goto(`${SITE}/online`);
await alice.page.getByRole('button', { name: '1+0', exact: true }).click();
await alice.page.getByRole('button', { name: 'Partie amicale' }).click();
await alice.page.getByRole('button', { name: 'Créer le défi' }).click();
await alice.page.getByText('Envoie ce lien à ton adversaire').waitFor();
const link = await alice.page.locator('#share-url').inputValue();
await alice.page.screenshot({ path: `${SHOTS}/6-challenge-link.png` });
await bob.page.goto(link);
await bob.page.getByText(/te défie/).waitFor();
await bob.page.screenshot({ path: `${SHOTS}/6-challenge-received.png` });
await bob.page.getByRole('button', { name: 'Accepter le défi' }).click();
await alice.page.locator('[data-square="e2"]').waitFor({ timeout: 10000 });
await bob.page.locator('[data-square="e2"]').waitFor({ timeout: 10000 });
check(true, 'challenge accepted from the link');
const w3 = (await myColor(alice)) === 'w' ? alice : bob;
const b3 = w3 === alice ? bob : alice;

// 7. Resign
await move(w3, 'd2', 'd4');
await waitPiece(b3, 'd4', 'wP');
await move(b3, 'd7', 'd5');
await waitPiece(w3, 'd5', 'bP');
w3.page.once('dialog', (d) => d.accept());
await w3.page.getByRole('button', { name: 'Abandonner' }).click();
await b3.page.getByText('Victoire !').waitFor({ timeout: 10000 });
check(true, 'resignation ends the game for both');

// 8. Spectator sees a finished game, read only
const spectator = await newPlayer('spectator');
await spectator.page.goto(`${SITE}/online/${gameId(alice)}`);
await spectator.page.getByText('Tu regardes cette partie').waitFor({ timeout: 10000 });
check(true, 'a visitor can watch a game');

// 9. Leaderboard and profile
await alice.page.goto(`${SITE}/leaderboard`);
await alice.page.getByText(`Alice${stamp}`.slice(0, 20)).waitFor();
await alice.page.screenshot({ path: `${SHOTS}/9-leaderboard.png` });
await bob.page.goto(`${SITE}/profile`);
await bob.page.getByText('Mes dernières parties').waitFor();
await bob.page.screenshot({ path: `${SHOTS}/9-profile-mobile.png`, fullPage: true });
check(true, 'leaderboard and profile load');

// 10. Flag fall (mock database only: the clock is moved back directly in Postgres)
if (process.env.PGDATABASE) {
  const { execFileSync } = await import('node:child_process');
  await alice.page.goto(`${SITE}/online`);
  await alice.page.getByRole('button', { name: '1+0', exact: true }).click();
  await alice.page.getByRole('button', { name: 'Partie amicale' }).click();
  await alice.page.getByRole('button', { name: 'Créer le défi' }).click();
  await alice.page.getByText('Envoie ce lien à ton adversaire').waitFor();
  await bob.page.goto(await alice.page.locator('#share-url').inputValue());
  await bob.page.getByRole('button', { name: 'Accepter le défi' }).click();
  const w4 = (await myColor(alice)) === 'w' ? alice : bob;
  const b4 = w4 === alice ? bob : alice;
  await move(w4, 'e2', 'e4');
  await waitPiece(b4, 'e4', 'wP');
  await move(b4, 'c7', 'c5');
  await waitPiece(w4, 'c5', 'bP');
  execFileSync('psql', ['-q', '-U', 'postgres', '-c',
    `update online_games set last_move_at = last_move_at - interval '61 seconds' where id = '${gameId(w4)}'`]);
  await b4.page.getByText('Victoire !').waitFor({ timeout: 15000 });
  await w4.page.getByText(/temps écoulé/).first().waitFor({ timeout: 15000 });
  check(true, 'flag fall detected by the clock and confirmed by the server');
  await w4.page.screenshot({ path: `${SHOTS}/10-timeout.png` });
}

await browser.close();
console.log(failures ? `${failures} FAILURE(S)` : 'E2E PASSED');
process.exit(failures ? 1 : 0);
