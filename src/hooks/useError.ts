import { useCallback } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// エラーハンドリングに関連するカスタムフック
// ログインページに戻るクリティカルなエラーが発生した場合に使用

export const useError = () => {
  const setSystemMessage = useAppStateStore((state) => state.setSystemMessage);
  const setItems = useTreeStateStore((state) => state.setItems);
  const setIsLoggedIn = useAppStateStore((state) => state.setIsLoggedIn);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const setCurrentTree = useTreeStateStore((state) => state.setCurrentTree);
  const setCurrentTreeName = useTreeStateStore((state) => state.setCurrentTreeName);
  const setCurrentTreeMembers = useTreeStateStore((state) => state.setCurrentTreeMembers);
  const setIsAccordionExpanded = useAppStateStore((state) => state.setIsAccordionExpanded);
  const isLoading = useAppStateStore((state) => state.isLoading);

  // エラーハンドリング ---------------------------------------------------------------------------
  const handleError = useCallback(
    (error: unknown) => {
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
    },
    [
      setSystemMessage,
      setItems,
      setIsLoggedIn,
      setIsLoading,
      setCurrentTree,
      setCurrentTreeName,
      setCurrentTreeMembers,
      setIsAccordionExpanded,
      isLoading,
    ]
  );

  return { handleError };
};
