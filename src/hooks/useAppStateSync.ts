import { useEffect, useCallback, useState } from 'react';
import { TreeItem, AppState } from '../types/types';
import { isValidAppSettingsState } from '../components/SortableTree/utilities';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, set } from 'firebase/database';

export const useAppStateSync = (
  items: TreeItem[],
  setItems: React.Dispatch<React.SetStateAction<TreeItem[]>>,
  hideDoneItems: boolean,
  setHideDoneItems: React.Dispatch<React.SetStateAction<boolean>>,
  darkMode: boolean,
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>,
  isLoggedIn: boolean,
  setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>,
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setMessage: React.Dispatch<React.SetStateAction<string | null>>,
) => {
  const [isLoadedFromExternal, setIsLoadedFromExternal] = useState(false);

  // エラーハンドリング
  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      setMessage('ログアウトしました。 : ' + error.message);
    } else {
      setMessage('ログアウトしました。不明なエラーが発生しました。');
    }
    setItems([]);
    signOut(getAuth());
    setIsLoggedIn(false);
    if (setIsLoading) setIsLoading(false);
  }, [setMessage, setItems, setIsLoggedIn, setIsLoading]);

  // ダークモード、完了済みアイテムの非表示設定の監視
  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }
    try {
      const db = getDatabase();
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

  // ダークモード、完了済みアイテムの非表示設定の保存
  useEffect(() => {
    const debounceSave = setTimeout(() => {
      const user = getAuth().currentUser;
      if (!user) {
        return;
      }

      if (isLoadedFromExternal) {
        setIsLoadedFromExternal(false);
        return;
      }

      try {
        const db = getDatabase();
        const userSettingsRef = ref(db, `users/${user.uid}/settings`);
        set(userSettingsRef, { darkMode, hideDoneItems });
      } catch (error) {
        handleError(error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
  }, [darkMode, hideDoneItems, isLoadedFromExternal, handleError]);

  // アプリの状態をJSONファイルとしてダウンロードする
  const handleDownloadAppState = () => {
    const appState = { items, hideDoneItems, darkMode };
    const appStateJSON = JSON.stringify(appState, null, 2); // 読みやすい形式でJSONを整形
    const blob = new Blob([appStateJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TaskTree_Backup.json'; // ダウンロードするファイルの名前
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { handleDownloadAppState };
};

export default useAppStateSync;