import { useEffect } from 'react';
import { getAuth, signInWithRedirect, OAuthProvider } from 'firebase/auth';

const authProvider = localStorage.getItem('auth_provider');

export const AuthElectronApple = () => {
  useEffect(() => {
    if (authProvider === 'apple') {
      localStorage.removeItem('auth_provider');
      return;
    }
    const provider = new OAuthProvider('apple.com');
    const auth = getAuth();
    localStorage.setItem('auth_provider', 'apple');
    signInWithRedirect(auth, provider);
  }, []);

  return <></>;
};
