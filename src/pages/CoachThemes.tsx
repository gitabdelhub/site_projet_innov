import React from 'react';

export const CoachThemes: React.FC = () => {
  const themes = [
    {
      id: 1,
      name: 'Mating Nets & King Hunts',
      icon: '👑',
      description: 'Practice tracking down the exposed enemy King in the center of the board. Learn patterns for coordinating Bishop and Knight checkmates.',
      difficulty: 'Intermediate',
      exercises: 12
    },
    {
      id: 2,
      name: 'Queen Sacrifices',
      icon: '⚔️',
      description: 'Explore chess themes where giving up your most powerful piece leads to forced checkmates or decisive positional wins.',
      difficulty: 'Advanced',
      exercises: 8
    },
    {
      id: 3,
      name: 'Opening Traps',
      icon: '🛡️',
      description: 'Study typical opening errors and defensive traps. Protect your f7-pawn and master early development tactics.',
      difficulty: 'Beginner',
      exercises: 15
    },
    {
      id: 4,
      name: 'Pawn Breakthroughs',
      icon: '♟️',
      description: 'Learn when and how to push pawns to create passed pawns and breakthrough the enemy position.',
      difficulty: 'Intermediate',
      exercises: 10
    },
    {
      id: 5,
      name: 'Back Rank Weakness',
      icon: '🏰',
      description: 'Identify and exploit back rank weaknesses. Learn to defend your own back rank and attack your opponent\'s.',
      difficulty: 'Beginner',
      exercises: 9
    },
    {
      id: 6,
      name: 'Piece Activity',
      icon: '🎯',
      description: 'Improve piece placement and coordination. Learn to maximize the potential of each piece in different positions.',
      difficulty: 'Intermediate',
      exercises: 11
    }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-500/10 text-green-500';
      case 'Intermediate': return 'bg-yellow-500/10 text-yellow-500';
      case 'Advanced': return 'bg-red-500/10 text-red-500';
      default: return 'bg-bg-dark text-text-secondary';
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-text-primary tracking-tight mb-2">🧩 Theme Analyzer</h1>
          <p className="text-text-secondary text-base max-w-xl mx-auto">
            Focus on specific chess themes to improve your understanding. Each theme contains targeted exercises and explanations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {themes.map((theme) => (
            <div key={theme.id} className="bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center text-accent text-2xl">
                  {theme.icon}
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${getDifficultyColor(theme.difficulty)}`}>
                  {theme.difficulty}
                </span>
              </div>
              
              <h3 className="font-bold text-text-primary text-lg mb-2">{theme.name}</h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">
                {theme.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <span className="text-xs text-text-secondary">
                  {theme.exercises} exercises
                </span>
                <button className="text-xs font-semibold text-accent hover:underline">
                  Start →
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-text-primary text-lg mb-4">📊 Your Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Themes Completed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Exercises Done</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0%</div>
              <div className="text-xs text-text-secondary">Overall Accuracy</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Current Streak</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
