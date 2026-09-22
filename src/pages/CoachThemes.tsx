import React from 'react';
import { Link } from 'react-router-dom';
import { PUZZLES, THEMES, getPuzzlesByTheme } from '../data/puzzles';
import { useProgress } from '../lib/progress';

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner': return 'bg-green-500/10 text-green-600';
    case 'Intermediate': return 'bg-yellow-500/10 text-yellow-600';
    case 'Advanced': return 'bg-red-500/10 text-red-500';
    default: return 'bg-bg-dark text-text-secondary';
  }
};

export const CoachThemes: React.FC = () => {
  const progress = useProgress();
  const solvedIn = (themeId: string) => getPuzzlesByTheme(themeId as any).filter((p) => progress.solvedPuzzles.includes(p.id)).length;
  const themesCompleted = THEMES.filter((t) => solvedIn(t.id) === getPuzzlesByTheme(t.id).length).length;
  const accuracy = progress.puzzleAttempts > 0 ? Math.round((progress.puzzleFirstTry / progress.puzzleAttempts) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-2">🧩 Theme Trainer</h1>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Focus on one tactical theme at a time. Each theme opens a set of puzzles verified by Stockfish.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {THEMES.map((theme) => {
            const total = getPuzzlesByTheme(theme.id).length;
            const solved = solvedIn(theme.id);
            return (
              <div key={theme.id} className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center text-accent text-2xl">{theme.icon}</div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getDifficultyColor(theme.difficulty)}`}>{theme.difficulty}</span>
                </div>
                <h3 className="font-bold text-text-primary text-lg mb-2">{theme.name}</h3>
                <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">{theme.description}</p>
                <div className="w-full bg-bg-darker h-1.5 rounded-full overflow-hidden mb-3">
                  <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${(solved / total) * 100}%` }} />
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-text-secondary">{solved} / {total} puzzles solved</span>
                  <Link to={`/coach/tactics?theme=${theme.id}`} className="text-xs font-semibold text-accent hover:underline">
                    {solved === total ? 'Practice again →' : solved > 0 ? 'Continue →' : 'Start →'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-text-primary text-lg mb-4">📊 Your Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><div className="text-3xl font-bold text-accent mb-1">{themesCompleted}/{THEMES.length}</div><div className="text-xs text-text-secondary">Themes Completed</div></div>
            <div><div className="text-3xl font-bold text-accent mb-1">{progress.solvedPuzzles.length}/{PUZZLES.length}</div><div className="text-xs text-text-secondary">Puzzles Solved</div></div>
            <div><div className="text-3xl font-bold text-accent mb-1">{accuracy}%</div><div className="text-xs text-text-secondary">First-try Accuracy</div></div>
            <div><div className="text-3xl font-bold text-accent mb-1">{progress.streak}</div><div className="text-xs text-text-secondary">Current Streak</div></div>
          </div>
        </div>
      </div>
    </div>
  );
};
