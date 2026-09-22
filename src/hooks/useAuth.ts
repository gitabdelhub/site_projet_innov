import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthProvider';

// Access the shared auth state provided by <AuthProvider> (see App.tsx)
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};
