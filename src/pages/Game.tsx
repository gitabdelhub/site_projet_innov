import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { MoveHistory } from '../components/MoveHistory';
import { EvaluationBar } from '../components/EvaluationBar';
import { Chat } from '../components/Chat';
import { AuthModal } from '../components/AuthModal';
import { GameRewinder } from '../components/GameRewinder';
import { useChessGame } from '../hooks/useChessGame';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { useMultiplayerGame } from '../hooks/useMultiplayerGame';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { soundEffects } from '../utils/soundEffects';
import { renderPieceSVG } from '../components/PieceSVGs';
import { LEVEL_SETTINGS } from '../hooks/useStockfish';
import type { GameResult } from '../types/chess';
import { useI18n, type MessageKey } from '../i18n/I18nProvider';
import { Icon } from '../components/Icon';
import { recordAiGame, suggestedLevel } from '../lib/adaptive';
import { CoachHint } from '../components/CoachHint';
import { supabase } from '../lib/supabase';
import type { Game as OnlineGame } from '../types/auth';
import { updateProgress, useProgress } from '../lib/progress';

const REASON_KEYS: Record<GameResult['reason'], MessageKey> = {
  checkmate: 'game.reason.checkmate',
  stalemate: 'game.reason.stalemate',
  threefold: 'game.reason.threefold',
  insufficient: 'game.reason.insufficient',
  'fifty-moves': 'game.reason.fiftyMoves',
  timeout: 'game.reason.timeout',
  resignation: 'game.reason.resignation',
  aborted: 'game.reason.aborted',
};

// Helper to calculate captured pieces from FEN
type PieceKey = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type PieceCount = Record<PieceKey, number>;

const getCapturedPieces = (fen: string) => {
  const startingCount: Record<'w' | 'b', PieceCount> = {
    w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
  };
  const activeCount: Record<'w' | 'b', PieceCount> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };

  try {
    const boardPart = fen.split(' ')[0];
    for (const char of boardPart) {
      if (char === '/') continue;
      if (char >= '1' && char <= '8') continue;
      const color = (char === char.toUpperCase() ? 'w' : 'b') as 'w' | 'b';
      const type = char.toLowerCase() as PieceKey;
      if (activeCount[color] && activeCount[color][type] !== undefined) {
        activeCount[color][type]++;
      }
    }
  } catch (e) {
    console.error(e);
  }

  const whiteCaptured: { type: string; color: 'b' }[] = [];
  const blackCaptured: { type: string; color: 'w' }[] = [];

  // White captured = black pieces that are dead
  (Object.keys(startingCount.b) as PieceKey[]).forEach((key) => {
    const deadCount = startingCount.b[key] - activeCount.b[key];
    for (let i = 0; i < deadCount; i++) {
      whiteCaptured.push({ type: key, color: 'b' });
    }
  });

  // Black captured = white pieces that are dead
  (Object.keys(startingCount.w) as PieceKey[]).forEach((key) => {
    const deadCount = startingCount.w[key] - activeCount.w[key];
    for (let i = 0; i < deadCount; i++) {
      blackCaptured.push({ type: key, color: 'w' });
    }
  });

  // Calculate material difference
  const values: PieceCount = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  let whiteVal = 0;
  let blackVal = 0;
  whiteCaptured.forEach(p => whiteVal += values[p.type as PieceKey]);
  blackCaptured.forEach(p => blackVal += values[p.type as PieceKey]);

  return { whiteCaptured, blackCaptured, materialAdvantage: whiteVal - blackVal };
};

// Component to render captured pieces list
const CapturedPieces: React.FC<{ pieces: { type: string; color: 'w' | 'b' }[] }> = ({ pieces }) => {
  const valueOrder = { q: 0, r: 1, b: 2, n: 3, p: 4, k: 5 };
  const sortedPieces = [...pieces].sort((a, b) => valueOrder[a.type as keyof typeof valueOrder] - valueOrder[b.type as keyof typeof valueOrder]);
  
  return (
    <div className="flex flex-wrap gap-0.5 opacity-70">
      {sortedPieces.map((p, idx) => (
        <div key={idx} className="w-4 h-4 md:w-5 md:h-5">
          {renderPieceSVG(p.color, p.type, "w-full h-full")}
        </div>
      ))}
    </div>
  );
};

// Formatter for seconds to MM:SS
const formatTime = (secs: number) => {
  const whole = Math.ceil(secs);
  const m = Math.floor(whole / 60).toString().padStart(2, '0');
  const s = (whole % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const Game = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const configured = isSupabaseConfigured();

  // Mode: 'menu' | 'ai' | 'online'
  const [gameMode, setGameMode] = useState<'menu' | 'ai' | 'online'>('menu');
  const [boardFlipped, setBoardFlipped] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'moves' | 'chat' | 'analysis'>('moves');
  const [rewindIndex, setRewindIndex] = useState<number | null>(null);
  const [isRewindMode, setIsRewindMode] = useState(false);

  // Pawn promotion local state
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: 'w' | 'b';
  } | null>(null);

  // Online selection state
  const [mpSelected, setMpSelected] = useState<string | null>(null);
  const [mpPossible, setMpPossible] = useState<string[]>([]);

  // Clocks/Timers
  const [whiteTime, setWhiteTime] = useState(600); // 10 mins
  const [blackTime, setBlackTime] = useState(600);
  const [timeWinner, setTimeWinner] = useState<'w' | 'b' | null>(null);

  // 1. VS AI Mode Hooks
  const aiGame = useChessGame();

  // 2. Online Mode Matchmaking Hooks
  const matchmaking = useMatchmaking();

  // 3. Online Mode Game Hooks
  const activeMpGameId = matchmaking.currentGame?.id || '';
  const mpGame = useMultiplayerGame(activeMpGameId);

  // Opened from a friend invitation: /game?game=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedGameId = searchParams.get('game');
  useEffect(() => {
    if (!linkedGameId || !user) return;
    supabase.from('games').select('*').eq('id', linkedGameId).maybeSingle().then(({ data }) => {
      if (data) {
        matchmaking.setCurrentGame(data as OnlineGame);
        setGameMode('online');
      }
      const next = new URLSearchParams(searchParams);
      next.delete('game');
      setSearchParams(next, { replace: true });
    });
  }, [linkedGameId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const onlineGameMode = (mpGame.game ?? matchmaking.currentGame)?.mode ?? 'ranked';

  // Active game variables depending on mode
  const isAiMode = gameMode === 'ai';
  const isOnlineMode = gameMode === 'online';
  const isGameActive = isAiMode || (isOnlineMode && !!matchmaking.currentGame);
  
  const fen = isAiMode ? aiGame.gameState.fen : mpGame.chess.fen();
  const turn = isAiMode ? aiGame.gameState.turn : mpGame.chess.turn();
  const status = isAiMode
    ? aiGame.gameState.status
    : !mpGame.game
      ? 'waiting'
      : mpGame.game.status === 'completed'
        ? 'completed'
        : mpGame.chess.isCheck() ? 'check' : 'playing';
  
  const moves = isAiMode ? aiGame.gameState.moves : (mpGame.game ? mpGame.chess.history({ verbose: true }).map(m => ({
    from: m.from,
    to: m.to,
    piece: { type: m.piece as any, color: m.color as 'w' | 'b' },
    captured: m.captured ? { type: m.captured as any, color: (m.color === 'w' ? 'b' : 'w') as 'w' | 'b' } : undefined,
    promotion: m.promotion as any,
    san: m.san
  })) : []);

  const lastMove = isAiMode 
    ? aiGame.gameState.lastMove 
    : (mpGame.game && mpGame.chess.history({ verbose: true }).length > 0
        ? {
            from: mpGame.chess.history({ verbose: true })[mpGame.chess.history({ verbose: true }).length - 1].from,
            to: mpGame.chess.history({ verbose: true })[mpGame.chess.history({ verbose: true }).length - 1].to,
          }
        : null);

  // Clocks shown on screen (seconds): the database clock online, the local one against the engine
  const showClocks = isAiMode || (isOnlineMode && mpGame.hasClock);
  const shownWhite = isOnlineMode ? mpGame.clock.white / 1000 : whiteTime;
  const shownBlack = isOnlineMode ? mpGame.clock.black / 1000 : blackTime;

  // Check if player is white or black in multiplayer
  const isMpWhite = isOnlineMode && matchmaking.currentGame?.white_player_id === user?.id;
  const isMpBlack = isOnlineMode && matchmaking.currentGame?.black_player_id === user?.id;
  const userColor = isOnlineMode ? (isMpWhite ? 'w' : 'b') : 'w';

  // Flip board automatically if player is Black in multiplayer
  useEffect(() => {
    if (isOnlineMode && isMpBlack) {
      setBoardFlipped(true);
    } else {
      setBoardFlipped(false);
    }
  }, [isOnlineMode, isMpBlack]);

  // Clocks ticking effect
  useEffect(() => {
    if (!isAiMode || (status !== 'playing' && status !== 'check')) return;
    if (timeWinner || (isAiMode && aiGame.result)) return;
    // Clock starts after White's first move
    if (moves.length === 0) return;

    // Tick every 100ms so fast replies still consume time
    const timer = setInterval(() => {
      const tick = (t: number) => Math.max(0, Math.round((t - 0.1) * 10) / 10);
      if (turn === 'w') setWhiteTime(tick);
      else setBlackTime(tick);
    }, 100);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameActive, turn, status, timeWinner, userColor, isAiMode, aiGame.result, moves.length > 0]);

  // Flag fall
  useEffect(() => {
    if (timeWinner || (whiteTime > 0 && blackTime > 0)) return;
    const winner = whiteTime <= 0 ? 'b' : 'w';
    setTimeWinner(winner);
    if (isAiMode) aiGame.declareResult({ winner, reason: 'timeout' });
    soundEffects.playGameOver(userColor === winner);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteTime, blackTime, timeWinner]);


  function getOnlineDrawReason(): GameResult['reason'] | null {
    const c = mpGame.chess;
    if (c.isStalemate()) return 'stalemate';
    if (c.isInsufficientMaterial()) return 'insufficient';
    if (c.isThreefoldRepetition()) return 'threefold';
    if (c.isDraw()) return 'fifty-moves';
    return null;
  }

  // Reset clocks on new game
  const resetClocks = () => {
    setWhiteTime(600);
    setBlackTime(600);
    setTimeWinner(null);
  };

  // Intercept square click for Pawn Promotion Modal
  const handleSquareClick = (square: string) => {
    if (timeWinner) return;
    if (isOnlineMode) {
      // Multiplayer move intercepting
      if (status !== 'playing' && status !== 'check') return;
      
      // Verify turn matches our color
      const chess = mpGame.chess;
      if (chess.turn() !== userColor) return;

      if (mpSelected && mpPossible.includes(square)) {
        const piece = chess.get(mpSelected as any);
        setMpSelected(null);
        setMpPossible([]);
        if (piece?.type === 'p' && (square[1] === '8' || square[1] === '1')) {
          setPendingPromotion({ from: mpSelected, to: square, color: piece.color });
        } else {
          mpGame.makeMove(mpSelected, square);
        }
        return;
      }
      const piece = chess.get(square as any);
      if (piece && piece.color === userColor && square !== mpSelected) {
        setMpSelected(square);
        setMpPossible(chess.moves({ square: square as any, verbose: true }).map((m) => m.to));
      } else {
        setMpSelected(null);
        setMpPossible([]);
      }
      return;
    }

    // AI Mode Selection
    if (isAiMode) {
      const from = aiGame.gameState.selectedSquare;
      const to = square;

      if (from && aiGame.gameState.possibleMoves.includes(to)) {
        // Inspect piece to check for promotion
        const chessTemp = new Chess(aiGame.gameState.fen);
        const piece = chessTemp.get(from as any);
        
        const isPawnPromotion = piece?.type === 'p' && (to[1] === '8' || to[1] === '1');
        if (isPawnPromotion) {
          setPendingPromotion({ from, to, color: piece.color });
          return;
        }
      }
      aiGame.selectSquare(square as any);
    }
  };

  // Promotion choice execution
  const handlePromoteSelect = (pieceType: string) => {
    if (pendingPromotion) {
      if (isAiMode) {
        aiGame.makeMove(pendingPromotion.from as any, pendingPromotion.to as any, pieceType);
      } else if (isOnlineMode) {
        mpGame.makeMove(pendingPromotion.from, pendingPromotion.to, pieceType);
      }
      setPendingPromotion(null);
    }
  };

  const handlePromoteCancel = () => {
    setPendingPromotion(null);
    if (isAiMode) {
      aiGame.selectSquare(aiGame.gameState.selectedSquare as any); // Deselect
    }
  };

  // Calculate FEN for rewind position
  const getRewindFen = (index: number | null) => {
    if (index === null || index === moves.length) return fen;
    
    const chess = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    for (let i = 0; i < index; i++) {
      const move = moves[i];
      chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    }
    return chess.fen();
  };

  const currentRewindFen = getRewindFen(rewindIndex);
  const displayFen = isRewindMode && rewindIndex !== null ? currentRewindFen : fen;

  // Captured pieces details
  const { whiteCaptured, blackCaptured, materialAdvantage } = getCapturedPieces(displayFen);

  // Game over summary (AI mode uses the engine result, online uses the stored game)
  const aiResult = isAiMode ? aiGame.result : null;
  const onlineResult: GameResult | null = isOnlineMode && mpGame.game?.status === 'aborted'
    ? { winner: null, reason: 'aborted' }
    : isOnlineMode && mpGame.game?.status === 'completed'
    ? {
        winner: mpGame.game.winner ? (mpGame.game.winner === mpGame.game.white_player_id ? 'w' : 'b') : null,
        reason: (mpGame.game.end_reason as GameResult['reason'] | null) ?? (mpGame.chess.isCheckmate() ? 'checkmate' : (getOnlineDrawReason() ?? 'resignation')),
      }
    : null;
  const finalResult = aiResult ?? onlineResult ?? (timeWinner ? { winner: timeWinner, reason: 'timeout' } as GameResult : null);
  const gameOverText = finalResult
    ? (finalResult.winner === null
        ? (finalResult.reason === 'aborted' ? t('game.aborted') : t('game.drawBy', { reason: t(REASON_KEYS[finalResult.reason]) }))
        : t(finalResult.winner === userColor ? 'game.youWinBy' : 'game.youLoseBy', { reason: t(REASON_KEYS[finalResult.reason]) }))
    : null;
  const [dismissedResult, setDismissedResult] = useState<string | null>(null);
  const resultKey = finalResult ? `${finalResult.winner}-${finalResult.reason}-${moves.length}` : null;
  const showGameOverModal = !!finalResult && dismissedResult !== resultKey && !isRewindMode;

  // Opponent that adjusts: every finished game against the computer updates the player's
  // strength, and "Auto" picks the level from it for the next game
  const progress = useProgress();
  const [autoLevel, setAutoLevel] = useState(true);
  const autoSuggestion = suggestedLevel(progress);
  const recordedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isAiMode || !aiResult || !resultKey || moves.length < 2 || recordedRef.current === resultKey) return;
    recordedRef.current = resultKey;
    const score = aiResult.winner === null ? 0.5 : aiResult.winner === userColor ? 1 : 0;
    updateProgress((p) => recordAiGame(p, aiGame.difficulty, score));
  }, [isAiMode, aiResult, resultKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return to hub
  const handleExitGame = () => {
    if (isOnlineMode) {
      if (mpGame.game?.status === 'playing') {
        if (!window.confirm(t('game.leaveConfirm'))) return;
        mpGame.resign();
      }
      matchmaking.setCurrentGame(null);
    }
    setGameMode('menu');
    resetClocks();
  };

  return (
    <div className={`min-h-screen bg-bg-dark px-2 sm:px-4 font-sans select-none ${isGameActive ? 'py-2 sm:py-3 lg:py-4' : 'py-4 sm:py-6'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Exit button on small screens (the sidebar has its own on desktop) */}
        {isGameActive && (
          <div className="flex justify-end mb-2 lg:hidden">
            <button
              onClick={handleExitGame}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-text-secondary hover:text-text-primary bg-bg-darker px-3 py-1.5 rounded-lg border border-gray-200/50 transition-colors"
            >
              <Icon name="arrowLeft" className="w-4 h-4" /> {t('game.exit')}
            </button>
          </div>
        )}

        {/* 1. Main Menu Hub */}
        {gameMode === 'menu' && (
          <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-fade-in py-8 sm:py-12">
            <div className="text-center">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">{t('game.menuTitle')}</h1>
              <p className="text-text-secondary text-sm sm:text-base">{t('game.menuSubtitle')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* vs Computer Card */}
              <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-3 sm:mb-4"><Icon name="board" className="w-6 h-6" /></div>
                  <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">{t('game.soloTitle')}</h3>
                  <p className="text-text-secondary text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                    {t('game.soloText')}
                  </p>
                </div>

                <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-text-secondary uppercase mb-2">{t('game.difficulty')}</label>
                    <select
                      value={autoLevel ? 'auto' : aiGame.difficulty}
                      onChange={(e) => {
                        const auto = e.target.value === 'auto';
                        setAutoLevel(auto);
                        if (!auto) aiGame.setDifficulty(Number(e.target.value) as any);
                      }}
                      className="w-full bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-3 sm:px-4 py-2 sm:py-3 font-semibold text-xs sm:text-sm focus:border-accent focus:outline-none"
                    >
                      <option value="auto">{t('adaptive.autoLevel', { n: autoSuggestion, label: t(`level.${autoSuggestion}` as MessageKey) })}</option>
                      {([1, 2, 3, 4, 5] as const).map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {t('game.levelOption', { n: lvl, label: t(`level.${lvl}` as MessageKey), elo: LEVEL_SETTINGS[lvl].elo })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      if (autoLevel) aiGame.setDifficulty(autoSuggestion);
                      aiGame.newGame();
                      resetClocks();
                      setGameMode('ai');
                      soundEffects.playMove();
                    }}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2.5 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-sm shadow-accent/25"
                  >
                    {t('game.start')}
                  </button>
                </div>
              </div>

              {/* Online Multiplayer Card */}
              <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent mb-3 sm:mb-4"><Icon name="users" className="w-6 h-6" /></div>
                  <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-2">{t('game.onlineTitle')}</h3>
                  <p className="text-text-secondary text-xs sm:text-sm mb-4 sm:mb-6 leading-relaxed">
                    {t('game.onlineText')}
                  </p>
                </div>

                <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-gray-100">
                  {!configured ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                      <p className="text-amber-800 text-xs font-semibold mb-1 flex items-center gap-1.5">
                        <Icon name="shield" className="w-4 h-4" /> {t('game.noDbTitle')}
                      </p>
                      <p className="text-amber-700/95 text-[11px] leading-relaxed">
                        {t('game.noDbText')}
                      </p>
                    </div>
                  ) : !user ? (
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="w-full bg-bg-dark border border-gray-200 hover:bg-bg-darker text-text-primary font-bold py-2.5 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm transition-all"
                    >
                      {t('game.signInToPlay')}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-bg-dark border border-gray-200 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-xs text-text-secondary font-medium">
                        <span>{t('game.myRating')}</span>
                        <span className="text-accent font-extrabold text-xs sm:text-sm">{user.elo_rating} Elo</span>
                      </div>
                      <button
                        onClick={async () => {
                          setGameMode('online');
                          soundEffects.playMove();
                          const ongoing = await matchmaking.findOngoingGame();
                          if (ongoing) matchmaking.setCurrentGame(ongoing);
                        }}
                        className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2.5 sm:py-3.5 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-sm shadow-accent/25"
                      >
                        {t('game.enterLobby')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Link
              to="/together"
              className="group mt-4 sm:mt-6 bg-bg-card border border-gray-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex items-center gap-4 hover:border-accent/40 hover:shadow-md transition-all"
            >
              <span className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0"><Icon name="swords" className="w-6 h-6" /></span>
              <span className="flex-1">
                <span className="block font-bold text-text-primary group-hover:text-accent transition-colors">{t('game.friendsTitle')}</span>
                <span className="block text-xs sm:text-sm text-text-secondary">{t('game.friendsText')}</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-accent">{t('game.friendsCta')} <Icon name="arrowRight" className="w-4 h-4" /></span>
            </Link>
          </div>
        )}

        {/* 2. Matchmaking Searching Screen */}
        {gameMode === 'online' && !matchmaking.currentGame && (
          <div className="max-w-md mx-auto py-16 text-center animate-fade-in space-y-6">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-bold text-text-primary">{t('game.findTitle')}</h2>
              
              {matchmaking.isSearching ? (
                <div className="space-y-6 py-4">
                  {/* Radar ripple animation */}
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping" />
                    <div className="absolute w-16 h-16 bg-accent/30 rounded-full animate-pulse" />
                    <div className="relative w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center text-lg font-bold">♞</div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-text-primary font-bold text-sm">{t('game.searching')}</p>
                    <p className="text-text-secondary text-xs">{t('game.window', { w: matchmaking.ratingWindow, s: matchmaking.waitedSeconds })}</p>
                  </div>
                  
                  <button
                    onClick={matchmaking.leaveQueue}
                    className="bg-danger/10 hover:bg-danger/20 text-danger font-bold text-xs py-2.5 px-6 rounded-xl transition-all border border-danger/20"
                  >
                    {t('game.cancelSearch')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {t('game.findText')}
                  </p>
                  {matchmaking.error && (
                    <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{matchmaking.error}</p>
                  )}
                  <button
                    onClick={matchmaking.joinQueue}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm shadow-accent/25"
                  >
                    {t('game.findMatch')}
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setGameMode('menu')}
              className="text-text-secondary hover:text-text-primary text-xs underline font-medium"
            >
              {t('game.backToMenu')}
            </button>
          </div>
        )}

        {/* 3. Active Game Screen */}
        {gameMode !== 'menu' && isGameActive && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            {/* Middle Column: Chessboard & Evaluation Bar */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="game-board-container flex flex-col items-center">
                {/* Opponent Profile Card (Top of Board) */}
                <div className="w-full flex justify-between items-center py-2 px-3 mb-2 bg-bg-card border border-gray-200/50 rounded-xl shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-bg-darker border border-gray-200 rounded-lg flex items-center justify-center font-bold text-lg text-text-secondary">
                      {isAiMode ? '🤖' : '👤'}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                        {isAiMode ? t('game.engineLevel', { n: aiGame.difficulty }) : (isMpWhite ? matchmaking.currentGame?.black_player_username : matchmaking.currentGame?.white_player_username)}
                        <span className="text-[10px] bg-bg-darker text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono">
                          {isAiMode ? `~${LEVEL_SETTINGS[aiGame.difficulty].elo}` : ((isMpWhite ? mpGame.ratings.black : mpGame.ratings.white) ?? '…')}
                        </span>
                      </div>
                      {/* Captured pieces by opponent */}
                      <div className="mt-1 flex items-center gap-1">
                        <CapturedPieces pieces={boardFlipped ? whiteCaptured : blackCaptured} />
                        {materialAdvantage < 0 && (
                          <span className="text-[10px] font-bold text-text-secondary ml-1">
                            +{Math.abs(materialAdvantage)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Clock */}
                  {showClocks && <div className={`font-mono font-bold text-base px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                    turn === (boardFlipped ? 'w' : 'b')
                      ? (boardFlipped ? shownWhite : shownBlack) < 20
                        ? 'bg-danger/10 text-danger border-danger/30 animate-pulse'
                        : 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-bg-darker text-text-secondary border-gray-200'
                  }`}>
                    ⏱️ {formatTime(boardFlipped ? shownWhite : shownBlack)}
                  </div>}
                </div>

                {/* Board & Evaluation Bar side-by-side */}
                <div className="w-full flex gap-3 md:gap-4 items-stretch justify-center">
                  <div className="hidden md:flex">
                    <EvaluationBar fen={displayFen} />
                  </div>
                  <div className="flex-1 relative">
                    {showGameOverModal && (
                      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-[2px] rounded-lg animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-[85%] max-w-[320px] text-center border border-gray-100">
                          <div className="text-4xl mb-2">
                            {finalResult?.winner === null ? '🤝' : finalResult?.winner === userColor ? '🏆' : '💀'}
                          </div>
                          <h3 className="text-xl font-extrabold text-gray-800 mb-1">
                            {finalResult?.reason === 'aborted' ? t('game.aborted') : finalResult?.winner === null ? t('game.draw') : finalResult?.winner === userColor ? t('game.youWin') : t('game.youLose')}
                          </h3>
                          <p className="text-sm text-gray-500 mb-5">
                            {finalResult?.winner === null
                              ? t('game.drawnBy', { reason: finalResult ? t(REASON_KEYS[finalResult.reason]) : '' })
                              : t('game.sideWinsBy', { side: t(finalResult?.winner === 'w' ? 'common.white' : 'common.black'), reason: finalResult ? t(REASON_KEYS[finalResult.reason]) : '' })}
                            {' · '}{t('game.movesCount', { n: Math.ceil(moves.length / 2) })}
                          </p>
                          <div className="space-y-2">
                            {isOnlineMode && (
                              <button
                                onClick={() => { matchmaking.setCurrentGame(null); setIsRewindMode(false); setRewindIndex(null); }}
                                className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
                              >
                                {t('game.newMatchCta')}
                              </button>
                            )}
                            {isAiMode && (
                              <button
                                onClick={() => { aiGame.newGame(); resetClocks(); setIsRewindMode(false); setRewindIndex(null); }}
                                className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
                              >
                                {t('game.playAgain')}
                              </button>
                            )}
                            <button
                              onClick={() => { setDismissedResult(resultKey); setActiveTab('analysis'); setIsRewindMode(true); setRewindIndex(0); }}
                              className="w-full bg-bg-darker hover:bg-bg-dark text-text-primary font-bold py-2.5 px-4 rounded-xl text-sm border border-gray-200 transition-colors"
                            >
                              {t('game.review')}
                            </button>
                            <button
                              onClick={() => setDismissedResult(resultKey)}
                              className="text-xs text-gray-500 hover:text-gray-800 underline font-medium"
                            >
                              {t('common.close')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    <ChessBoard
                      gameState={isAiMode && !(isRewindMode && rewindIndex !== null) ? aiGame.gameState : {
                        fen: displayFen,
                        turn: isRewindMode && rewindIndex !== null ? (new Chess(displayFen).turn()) : turn,
                        moves: [],
                        status: 'playing',
                        selectedSquare: isRewindMode ? null : mpSelected,
                        possibleMoves: isRewindMode ? [] : mpPossible,
                        lastMove: isRewindMode && rewindIndex !== null && rewindIndex > 0 ? {
                          from: moves[rewindIndex - 1].from,
                          to: moves[rewindIndex - 1].to
                        } : lastMove
                      }}
                      onSquareClick={isRewindMode ? () => {} : handleSquareClick}
                      pendingPromotion={pendingPromotion}
                      onPromoteSelect={handlePromoteSelect}
                      onPromoteCancel={handlePromoteCancel}
                      flipped={boardFlipped}
                    />
                  </div>
                </div>

                {/* Player Profile Card (Bottom of Board) */}
                <div className="w-full flex justify-between items-center py-2 px-3 mt-2 bg-bg-card border border-gray-200/50 rounded-xl shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-lg flex items-center justify-center font-bold text-lg text-accent">
                      👤
                    </div>
                    <div>
                      <div className="font-bold text-sm text-text-primary flex items-center gap-1.5">
                        {user ? user.username : t('game.guest')}
                        <span className="text-[10px] bg-bg-darker text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono">
                          {user ? user.elo_rating : '—'}
                        </span>
                      </div>
                      {/* Captured pieces by player */}
                      <div className="mt-1 flex items-center gap-1">
                        <CapturedPieces pieces={boardFlipped ? blackCaptured : whiteCaptured} />
                        {materialAdvantage > 0 && (
                          <span className="text-[10px] font-bold text-text-secondary ml-1">
                            +{materialAdvantage}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Clock */}
                  {showClocks && <div className={`font-mono font-bold text-base px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                    turn === (boardFlipped ? 'b' : 'w')
                      ? (boardFlipped ? shownBlack : shownWhite) < 20
                        ? 'bg-danger/10 text-danger border-danger/30 animate-pulse'
                        : 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-bg-darker text-text-secondary border-gray-200'
                  }`}>
                    ⏱️ {formatTime(boardFlipped ? shownBlack : shownWhite)}
                  </div>}
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar */}
            <div className="lg:col-span-4 space-y-4 flex flex-col justify-between game-sidebar-container">
              {/* Sidebar Header - Only visible on desktop when game is active */}
              {isGameActive && (
                <div className="hidden lg:flex items-center justify-between border-b border-gray-200/50 pb-2 mb-1">
                  <span className="text-sm font-bold text-text-primary">
                    {t(isAiMode ? 'game.soloTitle' : onlineGameMode === 'ranked' ? 'game.onlineTitle' : onlineGameMode === 'training' ? 'together.trainingGame' : 'together.friendGame')}
                  </span>
                  <button
                    onClick={handleExitGame}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-darker px-3 py-1.5 rounded-lg border border-gray-200/50 transition-colors"
                  >
                    <Icon name="arrowLeft" className="w-3.5 h-3.5" /> {t('game.exit')}
                  </button>
                </div>
              )}
              {/* Tab Selector */}
              <div className="flex border-b border-gray-200/80 bg-bg-card rounded-xl p-1 shadow-xs">
                <button
                  onClick={() => {
                    setActiveTab('moves');
                    setIsRewindMode(false);
                    setRewindIndex(null);
                  }}
                  className={`flex-1 font-bold text-xs py-2.5 px-4 rounded-lg transition-all ${
                    activeTab === 'moves' ? 'bg-accent text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('game.tabMoves')}
                </button>
                {isOnlineMode && (
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 font-bold text-xs py-2.5 px-4 rounded-lg transition-all ${
                      activeTab === 'chat' ? 'bg-accent text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {t('game.tabChat')}
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 font-bold text-xs py-2.5 px-4 rounded-lg transition-all ${
                    activeTab === 'analysis' ? 'bg-accent text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('game.tabAnalysis')}
                </button>
              </div>

              {/* Status and Move Log Card */}
              {activeTab === 'moves' ? (
                <div className="space-y-4 flex flex-col flex-1">
                  {/* Game Controls Card */}
                  <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm">
                    <h3 className="text-text-primary font-bold text-base mb-3 border-b border-gray-100 pb-2">{t('game.controls')}</h3>
                    
                    {/* Status Indicator */}
                    <div className="text-center py-3 bg-bg-darker rounded-xl border border-gray-200/40 mb-4 flex flex-col items-center justify-center">
                      <p className={`text-base font-extrabold ${
                        status === 'checkmate' || status === 'completed' ? 'text-danger' : status === 'check' ? 'text-amber-500' : 'text-text-primary'
                      }`}>
                        {gameOverText ? gameOverText : (
                          <>
                            {status === 'check' && `${t('game.check')} `}
                            {isAiMode
                              ? (turn === aiGame.playerColor ? t('game.yourTurn') : t('game.thinking'))
                              : (status === 'playing' || status === 'check') && ((turn === userColor) ? t('game.yourTurn') : t('game.opponentTurn'))}
                          </>
                        )}
                      </p>
                    </div>

                    {isOnlineMode && onlineGameMode !== 'ranked' && (
                      <p className="text-[11px] text-center text-text-secondary -mt-2 mb-3">{t('together.unrated')}</p>
                    )}
                    {isOnlineMode && onlineGameMode === 'training' && !finalResult && (
                      <div className="mb-3"><CoachHint fen={fen} disabled={turn !== userColor} /></div>
                    )}

                    {isOnlineMode && mpGame.canAbort && (
                      <button
                        onClick={mpGame.abort}
                        className="w-full mb-3 bg-bg-darker hover:bg-bg-dark text-text-primary font-bold py-2 px-4 rounded-xl text-xs border border-gray-200 transition-colors"
                      >
                        {t('game.abort')}
                      </button>
                    )}
                    {isOnlineMode && mpGame.error && (
                      <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 mb-3">{mpGame.error}</p>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      {isAiMode || (mpGame.game && mpGame.game.status !== 'playing') ? (
                        <button
                          onClick={() => {
                            setIsRewindMode(false);
                            setRewindIndex(null);
                            if (isAiMode) {
                              aiGame.newGame();
                              resetClocks();
                            } else {
                              matchmaking.setCurrentGame(null);
                            }
                          }}
                          className="bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                        >
                          {isAiMode ? t('game.newGame') : t('game.newMatch')}
                        </button>
                      ) : (
                        <button
                          onClick={() => { if (window.confirm(t('game.resignConfirm'))) mpGame.resign(); }}
                          className="bg-danger/10 hover:bg-danger/20 text-danger font-bold py-2.5 px-4 rounded-xl text-xs border border-danger/20 transition-colors"
                        >
                          <Icon name="flag" className="w-3.5 h-3.5 inline -mt-0.5" /> {t('game.resign')}
                        </button>
                      )}
                      {isAiMode ? (
                        <button
                          onClick={aiGame.undoMove}
                          disabled={!!aiGame.result || moves.length === 0}
                          className="disabled:opacity-40 disabled:cursor-not-allowed bg-bg-darker hover:bg-bg-card text-text-primary font-bold py-2.5 px-4 rounded-xl border border-gray-200 transition-colors text-xs"
                        >
                          {t('game.undo')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setBoardFlipped(!boardFlipped)}
                          className="bg-bg-darker hover:bg-bg-card text-text-primary font-bold py-2.5 px-4 rounded-xl border border-gray-200 transition-colors text-xs"
                        >
                          {t('game.flip')}
                        </button>
                      )}
                    </div>
                  </div>

                  {isAiMode && !aiGame.result && moves.length > 0 && (
                    <button
                      onClick={() => aiGame.declareResult({ winner: 'b', reason: 'resignation' })}
                      className="w-full -mt-2 bg-danger/10 hover:bg-danger/20 text-danger font-bold py-2 px-4 rounded-xl text-xs border border-danger/20 transition-colors"
                    >
                      <Icon name="flag" className="w-3.5 h-3.5 inline -mt-0.5" /> {t('game.resign')}
                    </button>
                  )}

                  {/* Moves History */}
                  <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm flex-1 overflow-hidden flex flex-col">
                    <p className="text-[10px] font-bold text-text-secondary uppercase mb-2">{t('game.moveList')}</p>
                    <MoveHistory moves={moves} />
                  </div>
                </div>
              ) : activeTab === 'chat' ? (
                /* Online Chat Panel */
                <div className="flex-1 overflow-hidden flex flex-col">
                  <Chat
                    messages={mpGame.messages}
                    onSendMessage={mpGame.sendMessage}
                    currentUserId={user?.id || ''}
                  />
                </div>
              ) : (
                /* Analysis Panel */
                <div className="flex-1 overflow-hidden flex flex-col">
                  <GameRewinder 
                    moves={moves} 
                    initialFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                    playerColor={userColor}
                    rewindIndex={rewindIndex}
                    setRewindIndex={setRewindIndex}
                    isRewindMode={isRewindMode}
                    setIsRewindMode={setIsRewindMode}
                    totalMoves={moves.length}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};
