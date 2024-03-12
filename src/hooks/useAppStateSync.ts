import { useEffect, useRef } from 'react';
import { AppState } from '../types/types';
import { isValidAppSettingsState } from '../components/SortableTree/utilities';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { useAppStateStore } from '../store/appStateStore';
import { useError } from './useError';

export const useAppStateSync = () => {
  const darkMode = useAppStateStore((state) => state.darkMode);
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);

  const prevDarkModeRef = useRef<boolean>(false);
  const prevHideDoneItemsRef = useRef<boolean>(false);


  // エラーハンドリング
  const { handleError } = useError();

  // ダークモード、完了済みアイテムの非表示設定の監視 ------------------------------------------------
  useEffect(() => {
    const user = getAuth().currentUser;
    const db = getDatabase();
    if (!user || !isLoggedIn || !db) {
      return;
    }
    try {
      const userSettingsRef = ref(db, `users/${user.uid}/settings`);
      onValue(userSettingsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data: AppState = snapshot.val();
          if (isValidAppSettingsState(data)) {
            prevDarkModeRef.current = data.darkMode;
            prevHideDoneItemsRef.current = data.hideDoneItems;
            setDarkMode(data.darkMode);
            setHideDoneItems(data.hideDoneItems);
          }
        }
      });
    } catch (error) {
      handleError(error);
    }
  }, [isLoggedIn, handleError, setDarkMode, setHideDoneItems]);

  // ダークモード、完了済みアイテムの非表示設定の保存 ------------------------------------------------
  useEffect(() => {
    const user = getAuth().currentUser;
    const db = getDatabase();
    if (!user || !db) {
      return;
    }

    // 前回の値から更新があった時のみDBに保存
    if (prevDarkModeRef.current === darkMode && prevHideDoneItemsRef.current === hideDoneItems) {
      return;
    }

    try {
      const userSettingsRef = ref(db, `users/${user.uid}/settings`);
      set(userSettingsRef, { darkMode, hideDoneItems });
      prevDarkModeRef.current = darkMode;
      prevHideDoneItemsRef.current = hideDoneItems;
    } catch (error) {
      handleError(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, hideDoneItems]);
};

export default useAppStateSync;
