import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const Game = () => {
  const { user } = useAuth();
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

  // Clocks/Timers
  const [whiteTime, setWhiteTime] = useState(600); // 10 mins
  const [blackTime, setBlackTime] = useState(600);
  const [timeWinner, setTimeWinner] = useState<string | null>(null);

  // 1. VS AI Mode Hooks
  const aiGame = useChessGame();

  // 2. Online Mode Matchmaking Hooks
  const matchmaking = useMatchmaking();

  // 3. Online Mode Game Hooks
  const activeMpGameId = matchmaking.currentGame?.id || '';
  const mpGame = useMultiplayerGame(activeMpGameId);

  // Active game variables depending on mode
  const isAiMode = gameMode === 'ai';
  const isOnlineMode = gameMode === 'online';
  const isGameActive = isAiMode || (isOnlineMode && !!matchmaking.currentGame);
  
  const fen = isAiMode ? aiGame.gameState.fen : (mpGame.game?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const turn = isAiMode ? aiGame.gameState.turn : (mpGame.game ? new Chess(mpGame.game.fen).turn() : 'w');
  const status = isAiMode ? aiGame.gameState.status : (mpGame.game ? mpGame.game.status : 'waiting');
  
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
    if (!isGameActive || status !== 'playing' && status !== 'check') return;
    if (timeWinner) return;

    const timer = setInterval(() => {
      if (turn === 'w') {
        setWhiteTime(t => {
          if (t <= 1) {
            clearInterval(timer);
            setTimeWinner('Black wins on time');
            soundEffects.playGameOver(userColor === 'b');
            return 0;
          }
          return t - 1;
        });
      } else {
        setBlackTime(t => {
          if (t <= 1) {
            clearInterval(timer);
            setTimeWinner('White wins on time');
            soundEffects.playGameOver(userColor === 'w');
            return 0;
          }
          return t - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameActive, turn, status, timeWinner, userColor]);

  // Keyboard shortcuts for rewinder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isRewindMode) return;
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setRewindIndex(prev => {
          if (prev === null || prev === 0) return prev;
          return prev - 1;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setRewindIndex(prev => {
          if (prev === null || prev >= moves.length) return prev;
          return prev + 1;
        });
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsRewindMode(false);
        setRewindIndex(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        // Toggle auto-play
        if (rewindIndex !== null && rewindIndex < moves.length) {
          setRewindIndex(prev => (prev || 0) + 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRewindMode, rewindIndex, moves.length]);

  // Reset clocks on new game
  const resetClocks = () => {
    setWhiteTime(600);
    setBlackTime(600);
    setTimeWinner(null);
  };

  // Intercept square click for Pawn Promotion Modal
  const handleSquareClick = (square: string) => {
    if (isOnlineMode) {
      // Multiplayer move intercepting
      if (status !== 'playing' && status !== 'check') return;
      
      // Verify turn matches our color
      const currentTurn = mpGame.chess.turn();
      const isOurTurn = (isMpWhite && currentTurn === 'w') || (isMpBlack && currentTurn === 'b');
      if (!isOurTurn) return;

      // Handle square selection / movements - handled by mpGame.selectSquare
      // For multiplayer, the ChessBoard uses its own internal state via mpGame
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

  // Return to hub
  const handleExitGame = () => {
    if (isOnlineMode) {
      matchmaking.setCurrentGame(null);
    }
    setGameMode('menu');
    resetClocks();
  };

  return (
    <div className={`min-h-screen bg-bg-dark px-4 font-sans select-none ${isGameActive ? 'py-3 lg:py-4' : 'py-4 md:py-6'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className={`flex items-center justify-between mb-4 border-b border-gray-200/50 pb-3 ${isGameActive ? 'lg:hidden' : ''}`}>
          <Link to="/" className="text-xl font-bold text-accent flex items-center gap-2 hover:opacity-85 transition-opacity">
            <span className="text-2xl">♞</span> Chess Hub
          </Link>
          {isGameActive && (
            <button
              onClick={handleExitGame}
              className="text-sm font-semibold text-text-secondary hover:text-text-primary bg-bg-darker px-4 py-2 rounded-lg border border-gray-200/50 transition-colors"
            >
              Exit Game
            </button>
          )}
        </div>

        {/* 1. Main Menu Hub */}
        {gameMode === 'menu' && (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in py-12">
            <div className="text-center">
              <h1 className="text-4xl font-extrabold text-text-primary tracking-tight mb-2">Play Chess</h1>
              <p className="text-text-secondary text-base">Choose how you want to play</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* vs Computer Card */}
              <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center text-accent text-2xl mb-4">♟️</div>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Solo Practice</h3>
                  <p className="text-text-secondary text-sm mb-6 leading-relaxed">
                    Sharpen your skills against a powerful chess engine. Choose your difficulty, take back moves, and improve your game.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase mb-2">Difficulty</label>
                    <select
                      value={aiGame.difficulty}
                      onChange={(e) => aiGame.setDifficulty(Number(e.target.value) as any)}
                      className="w-full bg-bg-dark border border-gray-200 text-text-primary rounded-xl px-4 py-3 font-semibold text-sm focus:border-accent focus:outline-none"
                    >
                      <option value={1}>Level 1 - Beginner (Elo ~800)</option>
                      <option value={2}>Level 2 - Easy (Elo ~1200)</option>
                      <option value={3}>Level 3 - Medium (Elo ~1600)</option>
                      <option value={4}>Level 4 - Hard (Elo ~2000)</option>
                      <option value={5}>Level 5 - Expert (Elo ~2400)</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      aiGame.newGame();
                      resetClocks();
                      setGameMode('ai');
                      soundEffects.playMove();
                    }}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-sm shadow-accent/25"
                  >
                    Start Game
                  </button>
                </div>
              </div>

              {/* Online Multiplayer Card */}
              <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center text-accent text-2xl mb-4">⚔️</div>
                  <h3 className="text-xl font-bold text-text-primary mb-2">Challenge Players</h3>
                  <p className="text-text-secondary text-sm mb-6 leading-relaxed">
                    Find opponents at your level instantly. Compete in ranked matches, earn your rating, and climb the leaderboard.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  {!configured ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                      <p className="text-amber-800 text-xs font-semibold mb-1 flex items-center gap-1.5">
                        ⚠️ Supabase Config Required
                      </p>
                      <p className="text-amber-700/95 text-[11px] leading-relaxed">
                        To test online mode, configure your <code className="bg-white/70 px-1 py-0.5 rounded font-mono">.env</code> file. Check the readme instructions for details.
                      </p>
                    </div>
                  ) : !user ? (
                    <button
                      onClick={() => setAuthModalOpen(true)}
                      className="w-full bg-bg-dark border border-gray-200 hover:bg-bg-darker text-text-primary font-bold py-3.5 px-4 rounded-xl text-sm transition-all"
                    >
                      Sign In / Sign Up to Play
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-bg-dark border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-text-secondary font-medium">
                        <span>My Rating:</span>
                        <span className="text-accent font-extrabold text-sm">{user.elo_rating} Elo</span>
                      </div>
                      <button
                        onClick={() => {
                          setGameMode('online');
                          soundEffects.playMove();
                        }}
                        className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-sm shadow-accent/25"
                      >
                        Enter Matchmaking Lobby
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Matchmaking Searching Screen */}
        {gameMode === 'online' && !matchmaking.currentGame && (
          <div className="max-w-md mx-auto py-16 text-center animate-fade-in space-y-6">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-8 shadow-sm space-y-6">
              <h2 className="text-2xl font-bold text-text-primary">Find a Match</h2>
              
              {matchmaking.isSearching ? (
                <div className="space-y-6 py-4">
                  {/* Radar ripple animation */}
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping" />
                    <div className="absolute w-16 h-16 bg-accent/30 rounded-full animate-pulse" />
                    <div className="relative w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center text-lg font-bold">♞</div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-text-primary font-bold text-sm">Searching for Opponent...</p>
                    <p className="text-text-secondary text-xs">Matching within ±150 Elo rating</p>
                  </div>
                  
                  <button
                    onClick={matchmaking.leaveQueue}
                    className="bg-danger/10 hover:bg-danger/20 text-danger font-bold text-xs py-2.5 px-6 rounded-xl transition-all border border-danger/20"
                  >
                    Cancel Search
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    Click "Find Match" to search the matchmaking queue for players of a similar skill level.
                  </p>
                  <button
                    onClick={matchmaking.joinQueue}
                    className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm shadow-accent/25"
                  >
                    Find Match
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setGameMode('menu')}
              className="text-text-secondary hover:text-text-primary text-xs underline font-medium"
            >
              ← Back to Main Menu
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
                        {isAiMode ? `Engine · Level ${aiGame.difficulty}` : (isMpWhite ? matchmaking.currentGame?.black_player_username : matchmaking.currentGame?.white_player_username)}
                        <span className="text-[10px] bg-bg-darker text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono">
                          {isAiMode ? `~${800 + aiGame.difficulty * 400}` : '1200'}
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
                  <div className={`font-mono font-bold text-base px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                    turn === (boardFlipped ? 'w' : 'b')
                      ? (boardFlipped ? whiteTime : blackTime) < 20
                        ? 'bg-danger/10 text-danger border-danger/30 animate-pulse'
                        : 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-bg-darker text-text-secondary border-gray-200'
                  }`}>
                    ⏱️ {formatTime(boardFlipped ? whiteTime : blackTime)}
                  </div>
                </div>

                {/* Board & Evaluation Bar side-by-side */}
                <div className="w-full flex gap-3 md:gap-4 items-stretch justify-center">
                  <div className="hidden md:flex">
                    <EvaluationBar fen={fen} />
                  </div>
                  <div className="flex-1">
                    <ChessBoard
                      gameState={isAiMode ? aiGame.gameState : {
                        fen: displayFen,
                        turn: isRewindMode && rewindIndex !== null ? (new Chess(displayFen).turn()) : turn,
                        moves: [],
                        status: isRewindMode ? 'playing' : (status as any),
                        selectedSquare: null,
                        possibleMoves: [],
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
                        {user ? user.username : 'Guest Player'}
                        <span className="text-[10px] bg-bg-darker text-text-secondary px-1.5 py-0.5 rounded font-bold font-mono">
                          {user ? user.elo_rating : '1200'}
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
                  <div className={`font-mono font-bold text-base px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                    turn === (boardFlipped ? 'b' : 'w')
                      ? (boardFlipped ? blackTime : whiteTime) < 20
                        ? 'bg-danger/10 text-danger border-danger/30 animate-pulse'
                        : 'bg-accent/10 text-accent border-accent/30'
                      : 'bg-bg-darker text-text-secondary border-gray-200'
                  }`}>
                    ⏱️ {formatTime(boardFlipped ? blackTime : whiteTime)}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Sidebar */}
            <div className="lg:col-span-4 space-y-4 flex flex-col justify-between game-sidebar-container">
              {/* Sidebar Header - Only visible on desktop when game is active */}
              {isGameActive && (
                <div className="hidden lg:flex items-center justify-between border-b border-gray-200/50 pb-2 mb-1">
                  <Link to="/" className="text-lg font-bold text-accent flex items-center gap-1.5 hover:opacity-85 transition-opacity">
                    <span className="text-xl">♞</span> Chess Hub
                  </Link>
                  <button
                    onClick={handleExitGame}
                    className="text-xs font-semibold text-text-secondary hover:text-text-primary bg-bg-darker px-3 py-1.5 rounded-lg border border-gray-200/50 transition-colors"
                  >
                    Exit Game
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
                  Moves
                </button>
                {isOnlineMode && (
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 font-bold text-xs py-2.5 px-4 rounded-lg transition-all ${
                      activeTab === 'chat' ? 'bg-accent text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Chat
                  </button>
                )}
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex-1 font-bold text-xs py-2.5 px-4 rounded-lg transition-all ${
                    activeTab === 'analysis' ? 'bg-accent text-white shadow-xs' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Analysis
                </button>
              </div>

              {/* Status and Move Log Card */}
              {activeTab === 'moves' ? (
                <div className="space-y-4 flex flex-col flex-1">
                  {/* Game Controls Card */}
                  <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm">
                    <h3 className="text-text-primary font-bold text-base mb-3 border-b border-gray-100 pb-2">Game Controls</h3>
                    
                    {/* Status Indicator */}
                    <div className="text-center py-3 bg-bg-darker rounded-xl border border-gray-200/40 mb-4 flex flex-col items-center justify-center">
                      <p className={`text-base font-extrabold ${
                        status === 'checkmate' ? 'text-danger' : status === 'check' ? 'text-amber-500' : 'text-text-primary'
                      }`}>
                        {status === 'check' && '⚠️ Check!'}
                        {status === 'checkmate' && '🏆 Checkmate!'}
                        {status === 'draw' && '🤝 Draw'}
                        {status === 'stalemate' && '🤝 Stalemate (Draw)'}
                        {status === 'playing' && (isAiMode && aiGame.isComputerThinking ? '🤖 Computer thinking...' : 'Your turn')}
                        {timeWinner && `⌛ ${timeWinner}`}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          if (isAiMode) {
                            aiGame.newGame();
                          } else {
                            // Multiplayer resign / draw is potential
                          }
                          resetClocks();
                        }}
                        className="bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                      >
                        New Game
                      </button>
                      {isAiMode ? (
                        <button
                          onClick={aiGame.undoMove}
                          className="bg-bg-darker hover:bg-bg-card text-text-primary font-bold py-2.5 px-4 rounded-xl border border-gray-200 transition-colors text-xs"
                        >
                          Undo Move
                        </button>
                      ) : (
                        <button
                          onClick={() => setBoardFlipped(!boardFlipped)}
                          className="bg-bg-darker hover:bg-bg-card text-text-primary font-bold py-2.5 px-4 rounded-xl border border-gray-200 transition-colors text-xs"
                        >
                          Flip Board
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Moves History */}
                  <div className="bg-bg-card border border-gray-200/80 rounded-xl p-4 shadow-sm flex-1 overflow-hidden flex flex-col">
                    <p className="text-[10px] font-bold text-text-secondary uppercase mb-2">Move List</p>
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
