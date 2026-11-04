import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { Game } from './pages/Game';
import { Play } from './pages/Play';
import { I18nProvider } from './i18n';
import { Coach } from './pages/Coach';
import { CoachElo } from './pages/CoachElo';
import { CoachTactics } from './pages/CoachTactics';
import { CoachPosition } from './pages/CoachPosition';
import { CoachThemes } from './pages/CoachThemes';

function App() {
  return (
    <I18nProvider>
    <Router>
      <div className="min-h-screen bg-bg-dark text-text-primary">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/game" element={<Play />} />
          <Route path="/play" element={<Play />} />
          <Route path="/online" element={<Game />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/coach/elo" element={<CoachElo />} />
          <Route path="/coach/tactics" element={<CoachTactics />} />
          <Route path="/coach/position" element={<CoachPosition />} />
          <Route path="/coach/themes" element={<CoachThemes />} />
        </Routes>
      </div>
    </Router>
    </I18nProvider>
  );
}

export default App;
