import { useEffect } from 'react';
import { getAuth, signInWithRedirect, OAuthProvider } from 'firebase/auth';

export const AuthElectronApple = () => {
  useEffect(() => {
    const provider = new OAuthProvider('apple.com');
    const auth = getAuth();
    signInWithRedirect(auth, provider);
  }, []);

  return <></>;
};
