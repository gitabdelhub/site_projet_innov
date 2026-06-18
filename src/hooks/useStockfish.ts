import { useState, useEffect, useRef, useCallback } from 'react';
import type { Difficulty } from '../types/chess';

interface StockfishHook {
  isReady: boolean;
  isThinking: boolean;
  getBestMove: (fen: string, difficulty: Difficulty) => Promise<string | null>;
  stop: () => void;
}

export const useStockfish = (): StockfishHook => {
  const [isReady, setIsReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const resolveMoveRef = useRef<((move: string | null) => void) | null>(null);

  useEffect(() => {
    // Create Stockfish worker from CDN
    const stockfishUrl = 'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js';
    const worker = new Worker(stockfishUrl);

    workerRef.current = worker;

    worker.onmessage = (e) => {
      const message = e.data;

      if (message === 'uciok') {
        setIsReady(true);
      }

      if (message.startsWith('bestmove')) {
        const move = message.split(' ')[1];
        if (resolveMoveRef.current) {
          resolveMoveRef.current(move || null);
          resolveMoveRef.current = null;
          setIsThinking(false);
        }
      }
    };

    // Initialize UCI
    worker.postMessage('uci');
    worker.postMessage('isready');

    return () => {
      worker.postMessage('quit');
      worker.terminate();
    };
  }, []);

  const getBestMove = useCallback(async (fen: string, difficulty: Difficulty): Promise<string | null> => {
    if (!workerRef.current || !isReady) {
      return null;
    }

    setIsThinking(true);

    return new Promise((resolve) => {
      resolveMoveRef.current = resolve;

      // Set position
      workerRef.current!.postMessage(`position fen ${fen}`);

      // Set difficulty based on skill level and depth
      const skillLevel = difficulty * 2; // 2-10
      const depth = difficulty * 3; // 3-15

      workerRef.current!.postMessage(`setoption name Skill Level value ${skillLevel}`);
      workerRef.current!.postMessage(`setoption name Contempt value 0`);
      workerRef.current!.postMessage(`setoption name Aggressiveness value 100`);

      // Calculate move
      workerRef.current!.postMessage(`go depth ${depth}`);
    });
  }, [isReady]);

  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop');
      setIsThinking(false);
      if (resolveMoveRef.current) {
        resolveMoveRef.current(null);
        resolveMoveRef.current = null;
      }
    }
  }, []);

  return {
    isReady,
    isThinking,
    getBestMove,
    stop,
  };
};
