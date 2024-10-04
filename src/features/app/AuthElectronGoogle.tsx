import { useEffect } from 'react';
import { getAuth, signInWithRedirect, GoogleAuthProvider, getRedirectResult } from 'firebase/auth';

const authProvider = localStorage.getItem('auth_provider');

export const AuthElectronGoogle = () => {
  useEffect(() => {
    getRedirectResult(getAuth()).then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const url = '/auth/redirect?credential=' + JSON.stringify(credential);
        localStorage.removeItem('auth_provider');
        window.location.href = url;
      }
    });
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
