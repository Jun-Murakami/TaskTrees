import { useEffect } from 'react';
import { getAuth, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';

const authProvider = localStorage.getItem('auth_provider');

export const AuthElectronGoogle = () => {
  useEffect(() => {
    if (authProvider === 'google') {
      localStorage.removeItem('auth_provider');
      return;
    }
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    localStorage.setItem('auth_provider', 'google');
    signInWithRedirect(auth, provider);
  }, []);

  return <></>;
};
