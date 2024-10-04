import { useEffect } from 'react';
import { getAuth, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';

export const AuthElectronGoogle = () => {
  useEffect(() => {
    const provider = new GoogleAuthProvider();
    const auth = getAuth();
    signInWithRedirect(auth, provider);
  }, []);

  return <></>;
};
