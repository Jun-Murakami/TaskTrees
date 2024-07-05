import { useCallback } from 'react';
import { useAppStateStore } from '../store/appStateStore';
import { useFirebaseConnectionStatus } from './useFirebaseConnectionStatus';

export const useFirebaseConnection = () => {
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);

  const onConnected = useCallback(() => {
    setIsLoading(false);
  }, [setIsLoading]);

  const onDisconnected = useCallback(() => {
    setIsLoading(true);
  }, [setIsLoading]);

  return useFirebaseConnectionStatus(onConnected, onDisconnected);
};