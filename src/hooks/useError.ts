import { useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// エラーハンドリングに関連するカスタムフック
// ログインページに戻るクリティカルなエラーが発生した場合に使用

export const useError = () => {

  // エラーハンドリング ---------------------------------------------------------------------------
  const handleError = useCallback(
    (error: unknown) => {
      console.log('error', error);
      const isLoading = useAppStateStore.getState().isLoading;
      const setSystemMessage = useAppStateStore.getState().setSystemMessage;
      const setItems = useTreeStateStore.getState().setItems;
      const setIsLoggedIn = useAppStateStore.getState().setIsLoggedIn;
      const setIsLoading = useAppStateStore.getState().setIsLoading;
      const setCurrentTree = useTreeStateStore.getState().setCurrentTree;
      const setCurrentTreeName = useTreeStateStore.getState().setCurrentTreeName;
      const setCurrentTreeMembers = useTreeStateStore.getState().setCurrentTreeMembers;
      const setIsAccordionExpanded = useAppStateStore.getState().setIsAccordionExpanded;
      if (!isLoading) return;
      if (error instanceof Error) {
        setSystemMessage('ログアウトしました。 : \n\n' + error.message);
      } else {
        setSystemMessage('ログアウトしました。: \n\n' + error);
      }
      setCurrentTree(null);
      setCurrentTreeName(null);
      setCurrentTreeMembers(null);
      setItems([]);
      setIsAccordionExpanded(false);
      signOut(getAuth());
      FirebaseAuthentication.signOut();
      setIsLoggedIn(false);
      setIsLoading(false);
    }, []);

  return { handleError };
};
