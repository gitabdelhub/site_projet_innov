import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../online/auth';
import { AuthCard } from '../components/online/AuthCard';
import { OnlineChecking, OnlineUnavailable, useOnlineAvailable } from './OnlineLobby';

export const Login = () => {
  const available = useOnlineAvailable();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/online';

  useEffect(() => {
    if (user) navigate(target, { replace: true });
  }, [user, navigate, target]);

  if (available === null || loading) return <OnlineChecking />;
  if (!available) return <OnlineUnavailable />;
  return (
    <div className="flex justify-center px-4 py-10 sm:py-16">
      <AuthCard onDone={() => navigate(target, { replace: true })} />
    </div>
  );
};
