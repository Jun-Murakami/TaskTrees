import { useEffect } from 'react';
import isEqual from 'lodash/isEqual';
import { useTreeStateStore } from '../store/treeStateStore';
import { useTreeManagement } from './useTreeManagement';
import { useAppStateManagement } from './useAppStateManagement';
import { useError } from './useError';
import { useDatabase } from './useDatabase';
import { getDatabase, ref, onValue, } from 'firebase/database';
import { useAppStateStore } from '../store/appStateStore';

export const useObserve = () => {
  const uid = useAppStateStore((state) => state.uid);
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const items = useTreeStateStore((state) => state.items);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const prevItems = useTreeStateStore((state) => state.prevItems);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);

  const { loadTreesList, loadCurrentTreeData } = useTreeManagement();
  const { saveItemsDb } = useDatabase();
  const { loadSettingsFromDb } = useAppStateManagement();
  const { handleError } = useError();

  // サーバのタイムスタンプを監視 ------------------------------------------------
  const observeTimeStamp = async () => {
    if (!uid) {
      return;
    }
    setIsLoading(true);
    await loadSettingsFromDb();
    await loadTreesList();
    const timestampRef = ref(getDatabase(), `users/${uid}/timestamp`);
    onValue(timestampRef, async (snapshot) => {
      setIsLoading(true);
      const serverTimestamp = snapshot.val();
      const currentLocalTimestamp = useAppStateStore.getState().localTimestamp;
      if (serverTimestamp && serverTimestamp > currentLocalTimestamp) {
        setLocalTimestamp(serverTimestamp);
        await loadSettingsFromDb();
        await loadTreesList();
        const currentTree = useTreeStateStore.getState().currentTree;
        if (currentTree) {
          await loadCurrentTreeData(currentTree);
        }

      }
      setIsLoading(false);
    });
  };

  // ローカルitemsの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    // ツリー変更時には前回のitemsを保存して終了
    if (prevItems.length === 0) {
      setPrevItems(items);
      return;
    }
    if (!uid || !currentTree || isEqual(items, prevItems)) {
      return;
    }
    const debounceSave = setTimeout(() => {
      try {
        saveItemsDb(items, currentTree);
        setPrevItems(items);
      } catch (error) {
        handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return {
    observeTimeStamp

  };
}