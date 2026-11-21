import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { OnlineLobby } from './pages/OnlineLobby';
import { OnlineGame } from './pages/OnlineGame';
import { AuthProvider } from './online/auth';
import { Play } from './pages/Play';
import { Analyse } from './pages/Analyse';
import { Puzzles } from './pages/Puzzles';
import { Progress } from './pages/Progress';
import { I18nProvider } from './i18n';
import { Coach } from './pages/Coach';

function App() {
  return (
    <I18nProvider>
    <AuthProvider>
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
          <Route path="/online" element={<OnlineLobby />} />
          <Route path="/online/:id" element={<OnlineGame />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/coach/elo" element={<Analyse />} />
          <Route path="/coach/analyse" element={<Analyse />} />
          <Route path="/coach/tactics" element={<Puzzles />} />
          <Route path="/coach/puzzles" element={<Puzzles />} />
          <Route path="/coach/position" element={<Navigate to="/coach/puzzles" replace />} />
          <Route path="/coach/themes" element={<Navigate to="/coach/puzzles" replace />} />
          <Route path="/coach/progress" element={<Progress />} />
        </Routes>
      </div>
    </Router>
    </AuthProvider>
    </I18nProvider>
  );
}

export default App;
