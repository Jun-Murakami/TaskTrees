import { useEffect, useState } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { useAppStateStore } from '@/store/appStateStore';

export const useFirebaseConnection = () => {
  const [isConnected, setIsConnected] = useState(false);

  const setIsLoading = useAppStateStore((state) => state.setIsLoading);

  useEffect(() => {
    const db = getDatabase();
    const isLoading = useAppStateStore.getState().isLoading;
    const connectedRef = ref(db, '.info/connected');
    const unsubscribeDbConnectionChecker = onValue(connectedRef, (snap) => {
      setIsConnected(snap.val() === true);
      if (snap.val() === true && isLoading) {
        console.log('FirebaseDb Connected');
        setIsLoading(false);
      } else if (snap.val() === false && !isLoading) {
        setIsLoading(true);
      }
    });

    return () => unsubscribeDbConnectionChecker();
  }, [setIsLoading]);

  return isConnected;
};