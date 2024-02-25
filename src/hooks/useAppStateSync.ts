import { useEffect, useCallback, useState } from 'react';
import { TreeItem, TreesList, AppState } from '../types/types';
import { isValidAppSettingsState, isValidAppState } from '../components/SortableTree/utilities';
import { useDialogStore } from '../store/dialogStore';
import { getAuth, signOut } from 'firebase/auth';
import { getDatabase, ref, onValue, set, push, get } from 'firebase/database';
import { UniqueIdentifier } from '@dnd-kit/core';

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
  setCurrentTree: React.Dispatch<React.SetStateAction<UniqueIdentifier | null>>,
  setCurrentTreeName: React.Dispatch<React.SetStateAction<string | null>>,
  setCurrentTreeMembers: React.Dispatch<React.SetStateAction<{ uid: string; email: string }[] | null>>,
  setTreesList: React.Dispatch<React.SetStateAction<TreesList>>,
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>,
) => {
  const [isLoadedFromExternal, setIsLoadedFromExternal] = useState(false);
  const showDialog = useDialogStore((state) => state.showDialog);

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

  // ファイルを読み込んでアプリの状態を復元する
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const user = getAuth().currentUser;
    if (!user) {
      return;
    }

    const file = event.target.files?.[0];
    if (!file) {
      await showDialog('ファイルが選択されていません。', 'Information');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      try {
        const appState = JSON.parse(text as string);
        if (!isValidAppState(appState)) {
          await showDialog('無効なファイル形式です。', 'Error');
          return;
        } else {
          const db = getDatabase();
          const treesRef = ref(db, 'trees');
          const newTreeRef = push(treesRef);
          await set(newTreeRef, {
            items: appState.items,
            name: '読み込まれたツリー',
            members: [user?.uid],
          });

          if (!newTreeRef.key) {
            await showDialog('データベースへの保存に失敗しました。', 'Error');
            return;
          }
          // データベースのツリーリストに新しいツリーを追加
          const userTreeListRef = ref(db, `users/${user.uid}/treeList`);
          try {
            const snapshot = await get(userTreeListRef);
            let newTreeList: string[] = [];
            if (snapshot.exists()) {
              const data: string[] = snapshot.val();
              newTreeList = [newTreeRef.key, ...data];
            } else {
              newTreeList = [newTreeRef.key];
            }
            await set(userTreeListRef, newTreeList);
          } catch (error) {
            await showDialog('データベースのツリーリスト更新に失敗しました。' + error, 'Error');
          }

          // ツリーリストを更新
          setTreesList((prevTreesList) => {
            if (prevTreesList && newTreeRef.key) {
              return [{ id: newTreeRef.key, name: '読み込まれたツリー', ...prevTreesList }];
            } else {
              return prevTreesList;
            }
          });

          if (user.email) {
            setCurrentTreeMembers([{ uid: user.uid, email: user.email }]);
          } else {
            setCurrentTreeMembers([{ uid: user.uid, email: 'unknown' }]);
          }
          setCurrentTree(newTreeRef.key);
          setCurrentTreeName('読み込まれたツリー');
          setItems(appState.items);
          setHideDoneItems(appState.hideDoneItems);
          setDarkMode(appState.darkMode);
          setIsExpanded(false);
          await showDialog('ファイルが正常に読み込まれました。', 'Information');
        }
      } catch (error) {
        await showDialog('ファイルの読み込みに失敗しました。', 'Error');
      }
    };
    reader.readAsText(file);
  };

  return { handleDownloadAppState, handleFileUpload };
};

export default useAppStateSync;