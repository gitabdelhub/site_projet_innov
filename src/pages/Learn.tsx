import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Move } from 'chess.js';
import { ChessBoard } from '../components/ChessBoard';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { renderPieceSVG } from '../components/PieceSVGs';
import { LESSONS, lessonById, type Lesson } from '../data/lessons';
import { judgeLessonMove, keepTurn, lessonBoard, starsSolution } from '../lib/lessonRules';
import { updateProgress, useProgress } from '../lib/progress';
import { soundEffects } from '../utils/soundEffects';
import { useI18n, pick } from '../i18n/I18nProvider';
import { AiTeacher } from '../components/AiTeacher';

const LessonArt: React.FC<{ lesson: Lesson; className?: string }> = ({ lesson, className = 'w-7 h-7' }) =>
  'piece' in lesson.art ? renderPieceSVG('w', lesson.art.piece, className) : <Icon name={lesson.art.icon} className={className} />;

// ---------- The path: every lesson, in order ----------

export const Learn: React.FC = () => {
  const { t, lang } = useI18n();
  const progress = useProgress();
  const done = (id: string) => progress.lessonsDone.includes(id);
  const next = LESSONS.find((l) => !done(l.id));
  const count = LESSONS.filter((l) => done(l.id)).length;

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-5xl mx-auto">
        <PageHeader icon="graduation" title={t('learn.title')} subtitle={t('learn.subtitle')}>
          <div className="max-w-sm mx-auto mt-5">
            <div className="flex justify-between text-xs font-semibold text-text-secondary mb-1.5">
              <span>{t('learn.progress', { done: count, total: LESSONS.length })}</span>
              <span>{Math.round((count / LESSONS.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-bg-darker rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${(count / LESSONS.length) * 100}%` }} />
            </div>
          </div>
        </PageHeader>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LESSONS.map((l, i) => {
            const isNext = next?.id === l.id;
            return (
              <li key={l.id}>
                <Link
                  to={`/learn/${l.id}`}
                  className={`group h-full bg-bg-card border rounded-2xl p-5 flex flex-col gap-3 transition-all hover:shadow-md ${
                    isNext ? 'border-accent ring-2 ring-accent/15' : 'border-gray-200/80 hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${done(l.id) ? 'bg-green-500/10 text-green-700' : 'bg-accent/10 text-accent'}`}>
                      <LessonArt lesson={l} className="w-8 h-8" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('learn.lesson', { n: i + 1 })}</span>
                      <span className="block font-bold text-text-primary group-hover:text-accent transition-colors">{pick(l.title, lang)}</span>
                    </span>
                    {done(l.id) && <Icon name="check" className="w-5 h-5 text-green-600" label={t('learn.done')} />}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 flex-1">{pick(l.intro, lang)}</p>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${isNext ? 'text-accent' : 'text-text-secondary'}`}>
                    {isNext && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
                    {done(l.id) ? t('learn.review') : isNext ? (count ? t('learn.continue') : t('learn.start')) : t('learn.start')}
                    <Icon name="arrowRight" className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        <section className="mt-8 bg-bg-card border border-gray-200/80 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Icon name="board" className="w-6 h-6" />
          </span>
          <div className="flex-1">
            <h2 className="font-bold text-text-primary">{t('learn.afterTitle')}</h2>
            <p className="text-sm text-text-secondary">{t('learn.afterText')}</p>
          </div>
          <Link to="/game" className="inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors">
            {t('learn.playCta')} <Icon name="arrowRight" className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </div>
  );
};

// ---------- One lesson, played on the board ----------

type Status = 'playing' | 'right' | 'wrong';

export const LearnLesson: React.FC = () => {
  const { id = '' } = useParams();
  const { t, lang } = useI18n();
  const lesson = lessonById(id);
  const lessonIndex = LESSONS.findIndex((l) => l.id === id);
  const nextLesson = LESSONS[lessonIndex + 1];
  const progress = useProgress();

  const [exIndex, setExIndex] = useState(0);
  const ex = lesson?.exercises[exIndex];
  const [fen, setFen] = useState(ex?.fen ?? '');
  const [selected, setSelected] = useState<string | null>(null);
  const [possible, setPossible] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [stars, setStars] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState<Status>('playing');

  const reset = () => {
    if (!ex) return;
    setFen(ex.fen);
    setSelected(null);
    setPossible([]);
    setLastMove(null);
    setStars(ex.kind === 'stars' ? ex.targets : []);
    setMoves(0);
    setStatus('playing');
  };

  useEffect(() => setExIndex(0), [id]);
  useEffect(reset, [ex]); // eslint-disable-line react-hooks/exhaustive-deps

  const fewest = useMemo(() => (ex?.kind === 'stars' ? starsSolution(ex.fen, ex.targets) : null), [ex]);

  if (!lesson || !ex) {
    return (
      <div className="min-h-screen bg-bg-dark py-16 px-4 text-center">
        <p className="text-text-secondary mb-4">{t('learn.notFound')}</p>
        <Link to="/learn" className="text-accent font-bold hover:underline">{t('learn.back')}</Link>
      </div>
    );
  }

  const side = ex.fen.split(' ')[1] as 'w' | 'b';
  const lastExercise = exIndex === lesson.exercises.length - 1;
  const finished = status === 'right' && lastExercise;

  const succeed = () => {
    setStatus('right');
    soundEffects.playSuccess();
    if (lastExercise) updateProgress((p) => (p.lessonsDone.includes(lesson.id) ? p : { ...p, lessonsDone: [...p.lessonsDone, lesson.id] }));
  };

  const onSquareClick = (square: string) => {
    if (status !== 'playing') return;
    const board = lessonBoard(fen);

    if (selected && possible.includes(square)) {
      let move: Move;
      try {
        move = board.move({ from: selected, to: square, promotion: 'q' });
      } catch {
        return;
      }
      setSelected(null);
      setPossible([]);
      setLastMove({ from: move.from, to: move.to });
      const verdict = judgeLessonMove(ex, fen, move, board, stars);

      if (ex.kind === 'stars') {
        const left = stars.filter((s) => s !== move.to);
        setFen(keepTurn(board.fen(), side));
        setStars(left);
        setMoves((n) => n + 1);
        if (!left.length) succeed();
        else if (verdict === 'star') soundEffects.playCapture();
        else soundEffects.playMove();
        return;
      }

      setFen(board.fen());
      if (verdict === 'right') succeed();
      else {
        setStatus('wrong');
        soundEffects.playError();
      }
      return;
    }

    const piece = board.get(square as never);
    if (piece && piece.color === board.turn() && square !== selected) {
      setSelected(square);
      setPossible(board.moves({ square: square as never, verbose: true }).map((m) => m.to));
    } else {
      setSelected(null);
      setPossible([]);
    }
  };

  const feedback =
    status === 'playing'
      ? pick(ex.prompt, lang)
      : ex.kind === 'stars'
        ? `${t('learn.starsDone', { n: moves })}${fewest !== null && moves > fewest ? ` ${t('learn.starsBest', { n: fewest })}` : ''}`
        : status === 'right'
          ? pick(ex.success, lang)
          : ex.kind === 'move' && ex.wrong
            ? pick(ex.wrong, lang)
            : t('learn.wrong');

  return (
    <div className="min-h-screen bg-bg-dark py-4 sm:py-8 px-2 sm:px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <Link to="/learn" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary mb-4 px-2">
          <Icon name="arrowLeft" className="w-4 h-4" /> {t('learn.back')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col items-center order-2 lg:order-1">
            <div className="game-board-container flex flex-col items-center w-full">
              <ChessBoard
                gameState={{ fen, turn: side, moves: [], status: 'playing', selectedSquare: selected, possibleMoves: possible, lastMove }}
                onSquareClick={onSquareClick}
                pendingPromotion={null}
                onPromoteSelect={() => {}}
                onPromoteCancel={() => {}}
                flipped={side === 'b'}
                targets={stars}
              />
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
            <div className="bg-bg-card border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <LessonArt lesson={lesson} className="w-8 h-8" />
                </span>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('learn.lesson', { n: lessonIndex + 1 })}</div>
                  <h1 className="text-xl font-extrabold text-text-primary">{pick(lesson.title, lang)}</h1>
                </div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{pick(lesson.intro, lang)}</p>

              <div className="flex items-center gap-2">
                {lesson.exercises.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < exIndex || (i === exIndex && status === 'right') ? 'bg-green-500' : i === exIndex ? 'bg-accent' : 'bg-bg-darker'}`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs font-semibold text-text-secondary">
                <span>{t('learn.exercise', { n: exIndex + 1, total: lesson.exercises.length })}</span>
                {ex.kind === 'stars' && status === 'playing' && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="star" className="w-3.5 h-3.5 text-yellow-500" /> {t('learn.starsLeft', { n: stars.length })} · {t('learn.moves', { n: moves })}
                  </span>
                )}
              </div>

              <div
                aria-live="polite"
                className={`border rounded-xl p-4 ${status === 'right' ? 'border-green-500/40 bg-green-500/5' : status === 'wrong' ? 'border-red-500/40 bg-red-500/5' : 'border-gray-100 bg-bg-darker/40'}`}
              >
                {finished && <p className="text-sm font-extrabold text-green-700 mb-1">{t('learn.finished')}</p>}
                <p className="text-sm text-text-primary leading-relaxed font-medium">{feedback}</p>
                {finished && !nextLesson && <p className="text-sm text-text-secondary mt-2">{t('learn.allDone')}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={reset} className="inline-flex items-center justify-center gap-1.5 bg-bg-dark hover:bg-bg-darker text-text-primary font-bold py-2.5 px-4 rounded-xl text-xs border border-gray-200 transition-colors">
                  <Icon name="refresh" className="w-4 h-4" /> {t('common.retry')}
                </button>
                {status === 'right' && !lastExercise ? (
                  <button onClick={() => setExIndex((i) => i + 1)} className="inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors">
                    {t('learn.nextExercise')} <Icon name="arrowRight" className="w-4 h-4" />
                  </button>
                ) : finished ? (
                  <Link
                    to={nextLesson ? `/learn/${nextLesson.id}` : '/coach/tactics'}
                    className="inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-accent-hover text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors"
                  >
                    {nextLesson ? t('learn.nextLesson') : t('learn.toPuzzles')} <Icon name="arrowRight" className="w-4 h-4" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-text-secondary">
                    {progress.lessonsDone.includes(lesson.id) && (<><Icon name="check" className="w-4 h-4 text-green-600" /> {t('learn.done')}</>)}
                  </span>
                )}
              </div>
            </div>

            <AiTeacher
              kind="lesson"
              title={t('ai.lessonTitle')}
              cta={t('ai.lessonCta')}
              withQuestion
              payload={() => ({ lesson: pick(lesson.title, lang), exercise: pick(ex.prompt, lang) })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
