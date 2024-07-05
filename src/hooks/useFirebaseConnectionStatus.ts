import { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

export const useFirebaseConnectionStatus = (onConnectedCallback: () => void, onDisconnectedCallback: () => void) => {
  const [isConnected, setIsConnected] = useState(false);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
    if (connected) {
      onConnectedCallback();
    } else {
      onDisconnectedCallback();
    }
  }, [onConnectedCallback, onDisconnectedCallback]);

  useEffect(() => {
    const db = getDatabase();
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      handleConnectionChange(snap.val() === true);
    });

    return () => unsubscribe();
  }, [handleConnectionChange]);

  return isConnected;
};