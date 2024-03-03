import { useEffect, useState } from 'react';
import { AppState } from '../types/types';
import { isValidAppSettingsState } from '../components/SortableTree/utilities';
import { getAuth } from 'firebase/auth';
import { getDatabase, ref, onValue, set } from 'firebase/database';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { useError } from './useError';

export const useAppStateSync = () => {
  const [isLoadedFromExternal, setIsLoadedFromExternal] = useState(false);

  const darkMode = useAppStateStore((state) => state.darkMode);
  const setDarkMode = useAppStateStore((state) => state.setDarkMode);
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems);
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems);
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn);

  const items = useTreeStateStore((state) => state.items);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);

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
            setHideDoneItems(data.hideDoneItems);
            setDarkMode(data.darkMode);
            setIsLoadedFromExternal(true);
          }
        }
      });
    } catch (error) {
      handleError(error);
    }
  }, [isLoggedIn, handleError, setDarkMode, setHideDoneItems]);

  // ダークモード、完了済みアイテムの非表示設定の保存 ------------------------------------------------
  useEffect(() => {
    const debounceSave = setTimeout(() => {
      const user = getAuth().currentUser;
      const db = getDatabase();
      if (!user || !db) {
        return;
      }

      if (isLoadedFromExternal) {
        setIsLoadedFromExternal(false);
        return;
      }

      try {
        const userSettingsRef = ref(db, `users/${user.uid}/settings`);
        set(userSettingsRef, { darkMode, hideDoneItems });
      } catch (error) {
        handleError(error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
  }, [darkMode, hideDoneItems, isLoadedFromExternal, handleError]);

  // 現在の日時を取得する
  function getCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}`;
  }

  // アプリの状態をJSONファイルとしてダウンロードする
  const handleDownloadAppState = () => {
    const appState = { items, hideDoneItems, darkMode, currentTreeName };
    const appStateJSON = JSON.stringify(appState, null, 2); // 読みやすい形式でJSONを整形
    const blob = new Blob([appStateJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    if (!currentTreeName) {
      link.download = `TaskTree_Backup_${getCurrentDateTime()}.json`;
    } else {
      link.download = `TaskTree_${currentTreeName}_Backup_${getCurrentDateTime()}.json`;
    }
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { handleDownloadAppState };
};

export default useAppStateSync;