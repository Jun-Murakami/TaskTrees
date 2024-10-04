import { useEffect } from 'react';
import { getAuth, signInWithRedirect, OAuthProvider, getRedirectResult } from 'firebase/auth';

const authProvider = localStorage.getItem('auth_provider');

export const AuthElectronApple = () => {
  useEffect(() => {
    getRedirectResult(getAuth()).then((result) => {
      if (result) {
        const credential = OAuthProvider.credentialFromResult(result);
        const url = '/auth/redirect?credential=' + JSON.stringify(credential);
        localStorage.removeItem('auth_provider');
        window.location.href = url;
      }
    });
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
