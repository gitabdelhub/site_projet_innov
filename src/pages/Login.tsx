import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AuthForm } from '../components/AuthForm';

export const Login = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/game" replace />;

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center px-4 py-10 font-sans">
      <div className="bg-bg-card border border-gray-200/80 rounded-2xl p-8 max-w-md w-full shadow-sm">
        <AuthForm onDone={() => navigate('/game')} />
      </div>
    </div>
  );
};
