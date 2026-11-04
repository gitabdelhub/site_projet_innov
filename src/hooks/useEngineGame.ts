import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { getPlayEngine } from '../engine/engine';
import { getLevel } from '../engine/levels';
import {
  START_FEN,
  buildPgn,
  detectGameOver,
  fromUci,
  outcomeFor,
  toPlayed,
  type Color,
  type GameOver,
  type PlayedMove,
} from '../lib/chessGame';
import { newId, safeGet, safeRemove, safeSet, saveGame } from '../lib/storage';
import { soundEffects } from '../utils/soundEffects';

const CURRENT_KEY = 'chesshub.currentGame.v1';

export interface EngineGameSetup {
  playerColor: Color;
  levelId: number;
}

interface StoredGame extends EngineGameSetup {
  id: string;
  startFen: string;
  moves: PlayedMove[];
  over: GameOver | null;
  startedAt: string;
}

const emptyGame = (setup: EngineGameSetup): StoredGame => ({
  ...setup,
  id: newId(),
  startFen: START_FEN,
  moves: [],
  over: null,
  startedAt: new Date().toISOString(),
});

const playSound = (move: PlayedMove, chess: Chess, playerColor: Color) => {
  const over = detectGameOver(chess);
  if (over) soundEffects.playGameOver(outcomeFor(over.result, playerColor) === 'win');
  else if (chess.inCheck()) soundEffects.playCheck();
  else if (move.captured) soundEffects.playCapture();
  else soundEffects.playMove();
};

/**
 * Game against Stockfish. The list of moves is the single source of truth:
 * the position, the status and the result are all derived from it.
 */
export const useEngineGame = () => {
  const [game, setGame] = useState<StoredGame | null>(() => {
    const saved = safeGet<StoredGame | null>(CURRENT_KEY, null);
    return saved && Array.isArray(saved.moves) && !saved.over ? saved : null;
  });
  const [thinking, setThinking] = useState(false);
  const searchToken = useRef(0);

  const chess = useMemo(() => {
    const c = new Chess(game?.startFen ?? START_FEN);
    for (const m of game?.moves ?? []) c.move(fromUci(m.uci));
    return c;
  }, [game?.startFen, game?.moves]);

  const fen = chess.fen();
  const turn = chess.turn();
  const over = game?.over ?? null;
  const level = getLevel(game?.levelId ?? 4);

  // Persist the game in progress so a page refresh does not lose it.
  useEffect(() => {
    if (game && !game.over) safeSet(CURRENT_KEY, game);
    else safeRemove(CURRENT_KEY);
  }, [game]);

  const finish = useCallback((g: StoredGame, result: GameOver): StoredGame => {
    const lvl = getLevel(g.levelId);
    const finished = { ...g, over: result };
    const pgn = buildPgn(g.startFen, g.moves, {
      Event: 'Chess Hub vs Stockfish',
      Site: 'Chess Hub',
      Date: g.startedAt.slice(0, 10).replace(/-/g, '.'),
      White: g.playerColor === 'w' ? 'Player' : `Stockfish ~${lvl.elo}`,
      Black: g.playerColor === 'b' ? 'Player' : `Stockfish ~${lvl.elo}`,
      Result: result.result,
      Termination: result.reason,
    });
    saveGame({
      id: g.id,
      date: new Date().toISOString(),
      pgn,
      playerColor: g.playerColor,
      result: result.result,
      reason: result.reason,
      engineLevel: g.levelId,
      engineElo: lvl.elo,
      moves: g.moves.length,
    });
    return finished;
  }, []);

  /** Applies a move (UCI-like) to the current game. Returns false if illegal. */
  const applyMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (!game || game.over) return false;
      const c = new Chess(game.startFen);
      for (const m of game.moves) c.move(fromUci(m.uci));
      let mv;
      try {
        mv = c.move({ from, to, promotion });
      } catch {
        return false;
      }
      const played = toPlayed(mv);
      let next: StoredGame = { ...game, moves: [...game.moves, played] };
      const result = detectGameOver(c);
      if (result) next = finish(next, result);
      playSound(played, c, game.playerColor);
      setGame(next);
      return true;
    },
    [game, finish],
  );

  /** User move: only allowed on the player's turn. */
  const playerMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!game || game.over || turn !== game.playerColor || thinking) return false;
      return applyMove(from, to, promotion);
    },
    [game, turn, thinking, applyMove],
  );

  // Engine turn.
  useEffect(() => {
    if (!game || game.over || turn === game.playerColor) return;
    const token = ++searchToken.current;
    const engine = getPlayEngine();
    const lvl = getLevel(game.levelId);
    const startedAt = performance.now();
    const positionFen = fen;
    setThinking(true);

    const run = async () => {
      let uci: string | null = null;
      const legal = new Chess(positionFen).moves({ verbose: true });
      if (lvl.randomMove > 0 && Math.random() < lvl.randomMove && legal.length > 0) {
        const m = legal[Math.floor(Math.random() * legal.length)];
        uci = `${m.from}${m.to}${m.promotion ?? ''}`;
      } else {
        const r = await engine.search(positionFen, lvl.search);
        if (r.cancelled) return;
        uci = r.bestmove;
      }
      const wait = lvl.minDelay - (performance.now() - startedAt);
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
      if (token !== searchToken.current || !uci) return;
      const { from, to, promotion } = fromUci(uci);
      setThinking(false);
      applyMove(from, to, promotion);
    };
    void run();

    return () => {
      // Position changed or component unmounted: forget this search.
      searchToken.current++;
      engine.cancelAll();
      setThinking(false);
    };
    // applyMove changes with `game`; the effect must only re-run when the position changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, game?.id, game?.over, game?.playerColor]);

  const start = useCallback((setup: EngineGameSetup) => {
    searchToken.current++;
    getPlayEngine().newGame();
    setThinking(false);
    setGame(emptyGame(setup));
  }, []);

  /** Takes back the last move of the player (and the engine reply after it). */
  const undo = useCallback(() => {
    if (!game || game.over) return;
    searchToken.current++;
    getPlayEngine().cancelAll();
    setThinking(false);
    const moves = [...game.moves];
    if (moves.length === 0) return;
    moves.pop();
    // Keep popping until it is the player's turn again.
    while (moves.length > 0 && moves[moves.length - 1].color === game.playerColor) moves.pop();
    // If the player is Black and the engine opened, keep the engine's first move.
    if (moves.length === 0 && game.playerColor === 'b' && game.moves.length > 0) {
      moves.push(game.moves[0]);
    }
    setGame({ ...game, moves });
  }, [game]);

  const resign = useCallback(() => {
    if (!game || game.over) return;
    searchToken.current++;
    getPlayEngine().cancelAll();
    setThinking(false);
    setGame(finish(game, { result: game.playerColor === 'w' ? '0-1' : '1-0', reason: 'resign' }));
    soundEffects.playGameOver(false);
  }, [game, finish]);

  const quit = useCallback(() => {
    searchToken.current++;
    getPlayEngine().cancelAll();
    setThinking(false);
    setGame(null);
  }, []);

  const lastMove = game && game.moves.length > 0 ? game.moves[game.moves.length - 1] : null;
  const canUndo =
    !!game && !game.over && !thinking && game.moves.some((m) => m.color === game.playerColor);

  return {
    game,
    fen,
    turn,
    over,
    level,
    thinking,
    lastMove,
    canUndo,
    start,
    playerMove,
    undo,
    resign,
    quit,
    inCheck: chess.inCheck(),
  };
};
