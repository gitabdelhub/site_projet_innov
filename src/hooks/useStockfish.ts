import { useState, useEffect, useRef, useCallback } from 'react';
import type { Difficulty } from '../types/chess';

interface StockfishHook {
  isReady: boolean;
  isThinking: boolean;
  getBestMove: (fen: string, difficulty: Difficulty) => Promise<string | null>;
  stop: () => void;
  newGame: () => void;
}

// Engine settings per level (Stockfish 10: Skill Level 0-20).
// randomMoveChance lets the lowest levels make genuinely human-like mistakes.
export const LEVEL_SETTINGS: Record<Difficulty, { skill: number; depth: number; movetime: number; randomMoveChance: number; elo: number; label: string }> = {
  1: { skill: 0, depth: 1, movetime: 100, randomMoveChance: 0.35, elo: 600, label: 'Beginner' },
  2: { skill: 3, depth: 3, movetime: 300, randomMoveChance: 0.1, elo: 1000, label: 'Easy' },
  3: { skill: 8, depth: 6, movetime: 600, randomMoveChance: 0, elo: 1400, label: 'Medium' },
  4: { skill: 14, depth: 10, movetime: 1200, randomMoveChance: 0, elo: 1900, label: 'Hard' },
  5: { skill: 20, depth: 18, movetime: 2500, randomMoveChance: 0, elo: 2400, label: 'Expert' },
};

export const useStockfish = (): StockfishHook => {
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const resolveMoveRef = useRef<((move: string | null) => void) | null>(null);

  useEffect(() => {
    const worker = new Worker('/stockfish.js');
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const message = String(e.data);

      if (message === 'readyok') {
        setIsReady(true);
      }

      if (message.startsWith('bestmove')) {
        const move = message.split(' ')[1];
        const resolve = resolveMoveRef.current;
        resolveMoveRef.current = null;
        setIsThinking(false);
        resolve?.(move && move !== '(none)' ? move : null);
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => {
      resolveMoveRef.current?.(null);
      resolveMoveRef.current = null;
      worker.postMessage('quit');
      worker.terminate();
    };
  }, []);

  const getBestMove = useCallback((fen: string, difficulty: Difficulty): Promise<string | null> => {
    const worker = workerRef.current;
    if (!worker || !isReady) return Promise.resolve(null);

    // Cancel any pending search so its answer can never be applied to a newer position
    if (resolveMoveRef.current) {
      resolveMoveRef.current(null);
      resolveMoveRef.current = null;
      worker.postMessage('stop');
    }

    const settings = LEVEL_SETTINGS[difficulty];
    setIsThinking(true);

    return new Promise((resolve) => {
      resolveMoveRef.current = resolve;
      worker.postMessage(`setoption name Skill Level value ${settings.skill}`);
      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${settings.depth} movetime ${settings.movetime}`);
    });
  }, [isReady]);

  const stop = useCallback(() => {
    const worker = workerRef.current;
    if (!worker) return;
    if (resolveMoveRef.current) {
      resolveMoveRef.current(null);
      resolveMoveRef.current = null;
      worker.postMessage('stop');
    }
    setIsThinking(false);
  }, []);

  const newGame = useCallback(() => {
    stop();
    workerRef.current?.postMessage('ucinewgame');
    workerRef.current?.postMessage('isready');
  }, [stop]);

  return {
    isReady,
    isThinking,
    getBestMove,
    stop,
    newGame,
  };
};
