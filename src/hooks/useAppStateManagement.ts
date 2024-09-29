import { useCallback } from 'react';
import { AppState } from '@/types/types';
import { isValidAppSettingsState } from '@/features/sortableTree/utilities';
import { getDatabase, ref, get, set } from 'firebase/database';
import { useDatabase } from '@/hooks/useDatabase';
import { useAppStateStore } from '@/store/appStateStore';
import { useError } from '@/hooks/useError';

export const useAppStateManagement = () => {
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const setIsLoadedMemoFromDb = useAppStateStore((state) => state.setIsLoadedMemoFromDb);

  const { saveTimeStampDb } = useDatabase();
  // エラーハンドリング
  const { handleError } = useError();

  // ダークモード、完了済みアイテムの非表示設定の取得 ------------------------------------------------
  const loadSettingsFromDb = useCallback(async () => {
    const db = getDatabase();
    const uid = useAppStateStore.getState().uid;
    if (!uid || !db) {
      return;
    }
    try {
      const userSettingsRef = ref(db, `users/${uid}/settings`);
      await get(userSettingsRef).then((snapshot) => {
        if (snapshot.exists()) {
          const data: AppState = snapshot.val();
          if (isValidAppSettingsState(data)) {
            setDarkMode(data.darkMode);
            setHideDoneItems(data.hideDoneItems);
          } else {
            console.log('loadSettingsFromDb', data);
          }
        }
      });
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setDarkMode, setHideDoneItems]);

  // クイックメモの取得 ------------------------------------------------
  const loadQuickMemoFromDb = useCallback(async () => {
    const db = getDatabase();
    const uid = useAppStateStore.getState().uid;
    if (!uid || !db) {
      return;
    }
    try {
      const quickMemoRef = ref(db, `users/${uid}/quickMemo`);
      await get(quickMemoRef).then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (typeof data === 'string') {
            // クイックメモの内容をセット
            setIsLoadedMemoFromDb(true);
            setQuickMemoText(data);
          }
        }
      });
    } catch (error) {
      handleError(error);
    }
  }, [handleError, setIsLoadedMemoFromDb, setQuickMemoText]);

  // ダークモードと完了済みアイテムの非表示設定を保存 ------------------------------------------------
  const saveAppSettingsDb = useCallback(async (darkModeNew: boolean, hideDoneItemsNew: boolean) => {
    const db = getDatabase();
    const uid = useAppStateStore.getState().uid;
    if (!uid || !db) {
      return;
    }
    try {
      const userSettingsRef = ref(db, `users/${uid}/settings`);
      await set(userSettingsRef, { darkMode: darkModeNew, hideDoneItems: hideDoneItemsNew });
      await saveTimeStampDb(null);
    } catch (error) {
      handleError(error);
    }
  }, [handleError, saveTimeStampDb]);

  // クイックメモをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveQuickMemoDb = useCallback(async (quickMemoText: string) => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    try {
      const quickMemoRef = ref(getDatabase(), `users/${uid}/quickMemo`);
      await set(quickMemoRef, quickMemoText);
      await saveTimeStampDb(null);
    } catch (error) {
      handleError('クイックメモの変更をデータベースに保存できませんでした。\n\n' + error);
    }
  }, [handleError, saveTimeStampDb]);

  return { loadSettingsFromDb, loadQuickMemoFromDb, saveAppSettingsDb, saveQuickMemoDb };
};
