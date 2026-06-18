import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const { signUp, signIn, loading, error, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user) {
    navigate('/game');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await signUp(email, password, username);
      } else {
        await signIn(email, password);
      }
      navigate('/game');
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4 font-sans select-none">
      <div className="bg-bg-card border border-gray-200/85 rounded-2xl p-8 max-w-md w-full shadow-sm">
        <h2 className="text-3xl font-black text-text-primary mb-6 text-center">
          {isSignUp ? 'Create Account' : 'Sign In'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-text-secondary text-sm mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-bg-darker text-text-primary rounded-lg px-4 py-3 border border-bg-darker focus:border-accent focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-text-secondary text-sm mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-darker text-text-primary rounded-lg px-4 py-3 border border-bg-darker focus:border-accent focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-text-secondary text-sm mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-darker text-text-primary rounded-lg px-4 py-3 border border-bg-darker focus:border-accent focus:outline-none"
              required
              minLength={6}
            />
          </div>

          {error && (
            <p className="text-danger text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="text-text-secondary text-sm mt-6 text-center">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-accent hover:text-accent-hover ml-2 font-medium"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>

        <div className="mt-6 text-center">
          <Link to="/" className="text-text-secondary hover:text-text-primary text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};
