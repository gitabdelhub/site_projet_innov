/**
 * Stockfish wrapper running in a Web Worker (Stockfish 19 lite, WASM, single thread).
 *
 * Every search goes through a queue: only one search runs at a time, and each
 * search resolves with the result of ITS own position. A cancelled search
 * resolves with `cancelled: true` so the caller can ignore it safely.
 */

export const ENGINE_URL = '/engine/stockfish-19-lite-single.js';

/** Score from WHITE's point of view. `mate` > 0 means White mates. */
export interface Score {
  cp?: number;
  mate?: number;
}

export interface PvLine {
  multipv: number;
  depth: number;
  score: Score;
  pv: string[]; // UCI moves
}

export interface SearchResult {
  bestmove: string | null;
  score: Score | null;
  pv: string[];
  lines: PvLine[];
  cancelled: boolean;
}

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  nodes?: number;
  multipv?: number;
  /** 0..20, Stockfish "Skill Level". Ignored when `elo` is set. */
  skill?: number;
  /** 1320..3190, uses UCI_LimitStrength. */
  elo?: number;
  onInfo?: (lines: PvLine[]) => void;
}

interface Job {
  fen: string;
  opts: SearchOptions;
  resolve: (r: SearchResult) => void;
  cancelled: boolean;
}

const parseInfo = (line: string, whiteToMove: boolean): PvLine | null => {
  if (!line.startsWith('info') || !line.includes(' pv ')) return null;
  const tokens = line.split(' ');
  const get = (key: string) => {
    const i = tokens.indexOf(key);
    return i >= 0 ? tokens[i + 1] : undefined;
  };
  const depth = Number(get('depth') ?? 0);
  const multipv = Number(get('multipv') ?? 1);
  const scoreIdx = tokens.indexOf('score');
  if (scoreIdx < 0) return null;
  const kind = tokens[scoreIdx + 1];
  const raw = Number(tokens[scoreIdx + 2]);
  const sign = whiteToMove ? 1 : -1;
  const score: Score = kind === 'mate' ? { mate: raw * sign } : { cp: raw * sign };
  const pv = tokens.slice(tokens.indexOf('pv') + 1);
  return { depth, multipv, score, pv };
};

export class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private queue: Job[] = [];
  private current: Job | null = null;
  private listener: ((line: string) => void) | null = null;
  private lastOptions: Record<string, string> = {};

  constructor(url = ENGINE_URL) {
    this.worker = new Worker(url);
    this.worker.onmessage = (e: MessageEvent) => {
      const line = String(e.data);
      this.listener?.(line);
    };
    this.ready = new Promise((resolve) => {
      this.listener = (line) => {
        if (line === 'uciok') this.worker.postMessage('isready');
        if (line === 'readyok') {
          this.listener = null;
          resolve();
        }
      };
      this.worker.postMessage('uci');
    });
  }

  whenReady() {
    return this.ready;
  }

  private setOption(name: string, value: string | number) {
    const v = String(value);
    if (this.lastOptions[name] === v) return;
    this.lastOptions[name] = v;
    this.worker.postMessage(`setoption name ${name} value ${v}`);
  }

  search(fen: string, opts: SearchOptions = {}): Promise<SearchResult> {
    return new Promise((resolve) => {
      this.queue.push({ fen, opts, resolve, cancelled: false });
      void this.pump();
    });
  }

  /** Cancels every queued search and stops the running one. */
  cancelAll() {
    for (const job of this.queue) {
      job.cancelled = true;
      job.resolve({ bestmove: null, score: null, pv: [], lines: [], cancelled: true });
    }
    this.queue = [];
    if (this.current) {
      this.current.cancelled = true;
      this.worker.postMessage('stop');
    }
  }

  newGame() {
    this.cancelAll();
    this.worker.postMessage('ucinewgame');
  }

  private async pump() {
    if (this.current) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    await this.ready;

    const { fen, opts } = job;
    const whiteToMove = fen.split(' ')[1] !== 'b';
    if (opts.elo) {
      this.setOption('UCI_LimitStrength', 'true');
      this.setOption('UCI_Elo', Math.max(1320, Math.min(3190, Math.round(opts.elo))));
      this.setOption('Skill Level', 20);
    } else {
      this.setOption('UCI_LimitStrength', 'false');
      this.setOption('Skill Level', opts.skill ?? 20);
    }
    this.setOption('MultiPV', opts.multipv ?? 1);

    const lines = new Map<number, PvLine>();
    const result = await new Promise<SearchResult>((resolve) => {
      this.listener = (line) => {
        const info = parseInfo(line, whiteToMove);
        if (info) {
          lines.set(info.multipv, info);
          opts.onInfo?.([...lines.values()].sort((a, b) => a.multipv - b.multipv));
          return;
        }
        if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1];
          const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          const top = sorted[0];
          resolve({
            bestmove: move && move !== '(none)' ? move : null,
            score: top?.score ?? null,
            pv: top?.pv ?? [],
            lines: sorted,
            cancelled: job.cancelled,
          });
        }
      };
      this.worker.postMessage(`position fen ${fen}`);
      const go = ['go'];
      if (opts.depth) go.push('depth', String(opts.depth));
      if (opts.movetime) go.push('movetime', String(opts.movetime));
      if (opts.nodes) go.push('nodes', String(opts.nodes));
      if (go.length === 1) go.push('depth', '12');
      this.worker.postMessage(go.join(' '));
    });

    this.listener = null;
    this.current = null;
    if (!job.cancelled) job.resolve(result);
    else job.resolve({ ...result, cancelled: true });
    void this.pump();
  }

  terminate() {
    this.cancelAll();
    this.worker.terminate();
  }
}

/* Two shared engines: one plays, the other analyses. They never block each other. */
let playEngine: Engine | null = null;
let analysisEngine: Engine | null = null;

export const getPlayEngine = () => (playEngine ??= new Engine());
export const getAnalysisEngine = () => (analysisEngine ??= new Engine());

/** Score converted to centipawns (mate = +/- 10000 minus distance), White POV. */
export const scoreToCp = (s: Score | null | undefined): number => {
  if (!s) return 0;
  if (s.mate !== undefined) {
    if (s.mate === 0) return 0;
    return s.mate > 0 ? 10000 - s.mate * 10 : -10000 - s.mate * 10;
  }
  return s.cp ?? 0;
};

export const formatScore = (s: Score | null | undefined): string => {
  if (!s) return '0.0';
  if (s.mate !== undefined) return `${s.mate > 0 ? '' : '-'}M${Math.abs(s.mate)}`;
  const v = (s.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
};

/** Winning chances for White in percent (Lichess formula). */
export const winPercent = (cp: number): number => {
  const c = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
};
