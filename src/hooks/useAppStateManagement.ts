import { AppState } from '../types/types';
import { isValidAppSettingsState } from '../components/SortableTree/utilities';
import { getDatabase, ref, get, set } from 'firebase/database';
import { useDatabase } from './useDatabase';
import { useAppStateStore } from '../store/appStateStore';

import { useError } from './useError';

export const useAppStateManagement = () => {
  const uid = useAppStateStore((state) => state.uid);
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);

  const { saveTimeStampDb } = useDatabase();
  // エラーハンドリング
  const { handleError } = useError();

  // ダークモード、完了済みアイテムの非表示設定の取得 ------------------------------------------------
  const loadSettingsFromDb = async () => {
    const db = getDatabase();
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
  };

  // ダークモードと完了済みアイテムの非表示設定を保存 ------------------------------------------------
  const saveAppSettingsDb = (darkModeNew: boolean, hideDoneItemsNew: boolean) => {
    const db = getDatabase();
    if (!uid || !db) {
      return;
    }
    try {
      const userSettingsRef = ref(db, `users/${uid}/settings`);
      saveTimeStampDb();
      set(userSettingsRef, { darkMode: darkModeNew, hideDoneItems: hideDoneItemsNew });
    } catch (error) {
      handleError(error);
    }
  }

  return { loadSettingsFromDb, saveAppSettingsDb };
};
