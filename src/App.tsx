import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { AuthProvider } from './hooks/AuthProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { ProgressSync } from './lib/progressSync';
import { Home } from './pages/Home';

// Pages are loaded on demand so the home page stays light
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Leaderboard = lazy(() => import('./pages/Leaderboard').then((m) => ({ default: m.Leaderboard })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const Game = lazy(() => import('./pages/Game').then((m) => ({ default: m.Game })));
const Coach = lazy(() => import('./pages/Coach').then((m) => ({ default: m.Coach })));
const CoachElo = lazy(() => import('./pages/CoachElo').then((m) => ({ default: m.CoachElo })));
const CoachTactics = lazy(() => import('./pages/CoachTactics').then((m) => ({ default: m.CoachTactics })));
const CoachPosition = lazy(() => import('./pages/CoachPosition').then((m) => ({ default: m.CoachPosition })));
const CoachThemes = lazy(() => import('./pages/CoachThemes').then((m) => ({ default: m.CoachThemes })));

const Learn = lazy(() => import('./pages/Learn').then((m) => ({ default: m.Learn })));
const LearnLesson = lazy(() => import('./pages/Learn').then((m) => ({ default: m.LearnLesson })));

const PageLoader = () => (
  <div className="flex justify-center py-24">
    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <ProgressSync />
      <Router>
        <div className="min-h-screen bg-bg-dark text-text-primary">
          <Navigation />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/game" element={<Game />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/learn/:id" element={<LearnLesson />} />
              <Route path="/coach" element={<Coach />} />
              <Route path="/coach/elo" element={<CoachElo />} />
              <Route path="/coach/tactics" element={<CoachTactics />} />
              <Route path="/coach/position" element={<CoachPosition />} />
              <Route path="/coach/themes" element={<CoachThemes />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
    </I18nProvider>
  );
}

export default App;
