import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { useAppStateStore } from '../store/appStateStore';

export const useFirebaseConnection = () => {
  const [isConnected, setIsConnected] = useState(false);

  const isLoading = useAppStateStore((state) => state.isLoading);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);

  useEffect(() => {
    const db = getDatabase();
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      setIsConnected(snap.val() === true);
      if (snap.val() === true && isLoading) {
        setIsLoading(false);
      } else if (snap.val() === false && !isLoading) {
        setIsLoading(true);
      }
    });

    return () => unsubscribe();
  }, [isLoading, setIsLoading]);

  return isConnected;
};