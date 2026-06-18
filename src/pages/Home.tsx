import { Link } from 'react-router-dom';
import { renderPieceSVG } from '../components/PieceSVGs';

export const Home = () => {
  return (
    <div className="min-h-screen bg-bg-dark text-text-primary font-sans select-none">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24 border-b border-gray-200/40 bg-gradient-to-b from-bg-card to-bg-dark">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          
          {/* Left Text */}
          <div className="space-y-6 text-left animate-fade-in">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 rounded-full text-accent text-xs font-extrabold uppercase tracking-wide">
              👑 Chess Hub
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-text-primary tracking-tight leading-tight">
              Play Chess. <br />
              <span className="text-accent">Your Way.</span>
            </h1>
            <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-md">
              A beautifully crafted chess experience. Practice against the engine, challenge friends, or compete in ranked matches.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to="/game"
                className="bg-accent hover:bg-accent-hover text-white font-bold py-4 px-8 rounded-xl text-sm transition-all shadow-md shadow-accent/25 hover:-translate-y-0.5 active:translate-y-0"
              >
                Play Now
              </Link>
              <Link
                to="/leaderboard"
                className="bg-bg-darker hover:bg-bg-card border border-gray-200/80 text-text-primary font-bold py-4 px-8 rounded-xl text-sm transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Leaderboard
              </Link>
            </div>
          </div>

          {/* Right Visual: Styled mini chess board */}
          <div className="hidden md:flex justify-center items-center relative animate-fade-in">
            <div className="absolute inset-0 bg-accent/5 rounded-3xl blur-3xl -z-10" />
            <div className="bg-bg-card border-4 border-gray-300 shadow-2xl rounded-2xl p-4 w-72 h-72 grid grid-cols-4 grid-rows-4 relative rotate-2 hover:rotate-0 transition-transform duration-500">
              
              {/* Board Mock squares */}
              <div className="bg-board-light flex items-center justify-center relative">
                <span className="absolute top-0.5 left-1 text-[8px] font-bold text-board-dark">8</span>
                <span className="absolute bottom-0.5 right-1 text-[8px] font-bold text-board-dark">a</span>
              </div>
              <div className="bg-board-dark flex items-center justify-center">
                <div className="w-[80%] h-[80%] opacity-90">{renderPieceSVG('b', 'n')}</div>
              </div>
              <div className="bg-board-light" />
              <div className="bg-board-dark" />

              <div className="bg-board-dark" />
              <div className="bg-board-light flex items-center justify-center">
                <div className="w-[80%] h-[80%] opacity-90">{renderPieceSVG('w', 'b')}</div>
              </div>
              <div className="bg-board-dark" />
              <div className="bg-board-light" />

              <div className="bg-board-light" />
              <div className="bg-board-dark" />
              <div className="bg-board-light flex items-center justify-center">
                <div className="w-[80%] h-[80%] opacity-95">{renderPieceSVG('w', 'q')}</div>
              </div>
              <div className="bg-board-dark" />

              <div className="bg-board-dark" />
              <div className="bg-board-light" />
              <div className="bg-board-dark" />
              <div className="bg-board-light flex items-center justify-center">
                <div className="w-[80%] h-[80%] opacity-90">{renderPieceSVG('b', 'k')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 max-w-5xl mx-auto px-6">
        <h2 className="text-3xl font-extrabold text-text-primary text-center mb-12 tracking-tight">
          Designed for Chess Players
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 */}
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent text-2xl mb-6">♟️</div>
            <h3 className="text-lg font-bold text-text-primary mb-3">5 Difficulty Levels</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              From beginner to grandmaster level — pick your challenge and sharpen your skills with instant analysis and move undo.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent text-2xl mb-6">⚔️</div>
            <h3 className="text-lg font-bold text-text-primary mb-3">Play Real Opponents</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Find your match instantly. Compete in ranked games, climb the leaderboard, and chat with your opponent in real time.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent text-2xl mb-6">✨</div>
            <h3 className="text-lg font-bold text-text-primary mb-3">Beautiful Experience</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              Hand-crafted pieces, immersive sound effects, smooth animations, and a clean interface designed to let you focus on the game.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-bg-card border-t border-gray-200/30 text-center px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl font-extrabold text-text-primary tracking-tight">Ready to make your move?</h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Create an account to climb the rankings, or jump straight into a game — no setup needed.
          </p>
          <Link
            to="/game"
            className="bg-accent hover:bg-accent-hover text-white font-bold py-3.5 px-8 rounded-xl text-sm transition-all shadow-md shadow-accent/25 inline-block"
          >
            Start Playing
          </Link>
        </div>
      </section>
    </div>
  );
};
export default Home;
