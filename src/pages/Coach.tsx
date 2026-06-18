import { Link } from 'react-router-dom';

export const Coach: React.FC = () => {
  const coachSections = [
    {
      path: '/coach/elo',
      icon: '📊',
      title: 'Elo Prediction',
      description: 'Upload your games or link your Chess.com/Lichess accounts to predict your ELO rating and analyze your playing style.',
      color: 'from-blue-500/10 to-blue-600/5',
      borderColor: 'border-blue-500/20'
    },
    {
      path: '/coach/tactics',
      icon: '⚔️',
      title: 'Tactic Trainer',
      description: 'Sharpen your tactical vision with interactive puzzles. Find the best moves to improve your pattern recognition.',
      color: 'from-red-500/10 to-red-600/5',
      borderColor: 'border-red-500/20'
    },
    {
      path: '/coach/position',
      icon: '🎯',
      title: 'Position Trainer',
      description: 'Master critical positions from different openings and middlegames. Improve your positional understanding.',
      color: 'from-green-500/10 to-green-600/5',
      borderColor: 'border-green-500/20'
    },
    {
      path: '/coach/themes',
      icon: '🧩',
      title: 'Theme Analyzer',
      description: 'Focus on specific chess themes to improve your understanding. Each theme contains targeted exercises.',
      color: 'from-purple-500/10 to-purple-600/5',
      borderColor: 'border-purple-500/20'
    }
  ];

  return (
    <div className="min-h-screen bg-bg-dark py-8 px-4 font-sans select-none">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-text-primary tracking-tight mb-4">AI Chess Coach</h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Improve your chess with personalized training. Choose a training mode below to get started.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coachSections.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className={`group bg-gradient-to-br ${section.color} ${section.borderColor} border-2 rounded-2xl p-8 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]`}
            >
              <div className="flex items-start gap-4">
                <div className="text-5xl">{section.icon}</div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-text-primary mb-3 group-hover:text-accent transition-colors">
                    {section.title}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {section.description}
                  </p>
                </div>
                <div className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 bg-bg-card border border-gray-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-text-primary text-lg mb-4">📈 Your Progress</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Games Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Puzzles Solved</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Themes Mastered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">0</div>
              <div className="text-xs text-text-secondary">Training Hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
