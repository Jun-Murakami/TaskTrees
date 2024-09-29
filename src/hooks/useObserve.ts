import { useEffect, useCallback } from 'react';
import isEqual from 'lodash/isEqual';
import { get } from 'firebase/database';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { useAppStateManagement } from '@/hooks/useAppStateManagement';
import { useOfflineTree } from '@/hooks/useOfflineTree';
import { useError } from '@/hooks/useError';
import { useDatabase } from '@/hooks/useDatabase';
import { useIndexedDb } from '@/hooks/useIndexedDb';
import { getDatabase, ref, onValue } from 'firebase/database';
import * as timerService from '@/services/timerService';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { Preferences } from '@capacitor/preferences';

export const useObserve = () => {
  const isOffline = useAppStateStore((state) => state.isOffline);
  const uid = useAppStateStore((state) => state.uid);
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const isLoadedMemoFromDb = useAppStateStore((state) => state.isLoadedMemoFromDb);
  const setIsLoadedMemoFromDb = useAppStateStore((state) => state.setIsLoadedMemoFromDb);
  const setTreesList = useTreeStateStore((state) => state.setTreesList);
  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const currentTree = useTreeStateStore((state) => state.currentTree);
  const currentTreeName = useTreeStateStore((state) => state.currentTreeName);
  const prevItems = useTreeStateStore((state) => state.prevItems);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);
  const prevCurrentTree = useTreeStateStore((state) => state.prevCurrentTree);
  const setPrevCurrentTree = useTreeStateStore((state) => state.setPrevCurrentTree);

  const showDialog = useDialogStore((state) => state.showDialog);

  const { loadCurrentTreeData } = useTreeManagement();
  const { loadAndSyncOfflineTree } = useOfflineTree();
  const { loadTreesListFromDb, saveItemsDb } = useDatabase();
  const {
    syncDb,
    checkAndSyncDb,
    loadSettingsFromIdb,
    loadTreesListFromIdb,
    saveSettingsIdb,
    saveItemsIdb,
    saveTreesListIdb,
    saveQuickMemoIdb,
    copyTreeDataToIdbFromDb,
  } = useIndexedDb();
  const { loadSettingsFromDb, loadQuickMemoFromDb, saveQuickMemoDb } = useAppStateManagement();
  const { handleError } = useError();

  // サーバのタイムスタンプを監視 ------------------------------------------------
  const observeTimeStamp = useCallback(async () => {
    const uid = useAppStateStore.getState().uid;
    if (!uid) {
      return;
    }
    setIsLoading(true);
    await checkAndSyncDb();
    await loadSettingsFromIdb();
    await loadTreesListFromIdb();
    await loadQuickMemoFromDb();
    setIsLoading(false);
    await loadAndSyncOfflineTree();

    // Firebaseのタイムスタンプを監視
    const timestampRef = ref(getDatabase(), `users/${uid}/timestamp`);
    const unsubscribeDbObserver = onValue(timestampRef, async (snapshot) => {
      setIsLoading(true);
      const serverTimestamp = snapshot.val();
      const currentLocalTimestamp = useAppStateStore.getState().localTimestamp;
      if (serverTimestamp && serverTimestamp > currentLocalTimestamp) {
        setLocalTimestamp(serverTimestamp);
        const newTreesList = await loadTreesListFromDb(uid);
        setTreesList(newTreesList);
        await saveTreesListIdb(newTreesList);
        await loadSettingsFromDb();
        const darkMode = useAppStateStore.getState().darkMode;
        const hideDoneItems = useAppStateStore.getState().hideDoneItems;
        await saveSettingsIdb(darkMode, hideDoneItems);
        await loadQuickMemoFromDb();
        // treesListを反復して、タイムスタンプをチェックし、最新のツリーをコピー
        const treeIds = newTreesList.map((tree) => tree.id);
        let treeUpdateCount = 0;
        for (const treeId of treeIds) {
          setIsLoading(true);
          const treeRef = ref(getDatabase(), `trees/${treeId}`);
          await get(treeRef).then(async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              if (data.timestamp > currentLocalTimestamp) {
                await copyTreeDataToIdbFromDb(treeId);
                treeUpdateCount++;
              }
            }
          });
        }
        if (treeUpdateCount == 0) {
          setIsLoading(true);
          const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
          await get(timestampV2Ref).then(async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              if (data !== serverTimestamp) {
                await syncDb();
              }
            }
          });
        }
        const currentTree = useTreeStateStore.getState().currentTree;
        if (currentTree) {
          setIsLoading(true);
          setPrevCurrentTree(null);
          await loadCurrentTreeData(currentTree);
        }
      }
      setIsLoading(false);
    });


    // Firebaseの接続状態を監視
    const connectedRef = ref(getDatabase(), '.info/connected');
    const unsubscribeDbConnectionChecker = onValue(connectedRef, (snap) => {
      const isLoading = useAppStateStore.getState().isLoading;
      const setIsConnectedDb = useAppStateStore.getState().setIsConnectedDb;
      setIsConnectedDb(snap.val() === true);
      if (snap.val() === true && isLoading) {
        setIsLoading(false);
      } else if (snap.val() === false && !isLoading) {
        setIsLoading(true);
      }
    });

    return () => {
      unsubscribeDbObserver();
      unsubscribeDbConnectionChecker();
    };
  }, [
    checkAndSyncDb,
    syncDb,
    loadSettingsFromIdb,
    loadTreesListFromIdb,
    loadQuickMemoFromDb,
    copyTreeDataToIdbFromDb,
    loadCurrentTreeData,
    loadAndSyncOfflineTree,
    loadTreesListFromDb,
    setTreesList,
    saveTreesListIdb,
    loadSettingsFromDb,
    saveSettingsIdb,
    setIsLoading,
    setLocalTimestamp,
    setPrevCurrentTree,
  ]);

  // ローカルitemsの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if ((!uid && !isOffline) || !currentTree || (!isConnectedDb && !isOffline)) {
      return;
    }

    // タイマーのチェック
    const intervalId = setInterval(async () => {
      const recentItems = useTreeStateStore.getState().items;
      const { hasChanges, updatedItems, notificationMessages } = await timerService.checkAndUpdateItems(recentItems);

      if (hasChanges) {
        setItems(updatedItems);
        for (const message of notificationMessages) {
          await showDialog(message, 'Alerm');
        }
      }
    }, 60000); // 1分ごとにチェック

    if (!isEqual(items, prevItems)) {
      if (currentTree !== prevCurrentTree) {
        if (prevItems.length > 0) {
          const asyncFunc = async () => {
            if (prevCurrentTree) {
              await saveItemsIdb(prevItems, prevCurrentTree);
              await saveItemsDb(prevItems, prevCurrentTree);
            }
          };
          asyncFunc();
        }
        setPrevCurrentTree(currentTree);
        setPrevItems([]);
      } else {
        setPrevItems(items);
        const targetTree = currentTree;
        const debounceSave = setTimeout(() => {
          try {
            if (isOffline) {
              Preferences.set({
                key: `items_offline`,
                value: JSON.stringify(items),
              });
              if (currentTreeName) {
                Preferences.set({
                  key: `treeName_offline`,
                  value: currentTreeName,
                });
              }
            } else {
              const asyncFunc = async () => {
                await saveItemsIdb(items, targetTree);
                await saveItemsDb(items, targetTree);
              };
              asyncFunc();
            }
            setPrevItems([]);
          } catch (error) {
            handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
          }
        }, 5000);

        return () => clearTimeout(debounceSave);
      }
    }

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ローカルのクイックメモの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    if ((!uid && !isOffline) || (!isConnectedDb && !isOffline) || !quickMemoText) {
      return;
    }
    if (isLoadedMemoFromDb) {
      setIsLoadedMemoFromDb(false);
      return;
    }
    const debounceSave = setTimeout(() => {
      try {
        if (isOffline) {
          // オフラインモードの場合、ローカルストレージに保存
          Preferences.set({
            key: `quick_memo_offline`,
            value: quickMemoText,
          });
        } else {
          const asyncFunc = async () => {
            await saveQuickMemoIdb(quickMemoText);
            await saveQuickMemoDb(quickMemoText);
          };
          asyncFunc();
        }
      } catch (error) {
        handleError('クイックメモの変更をデータベースに保存できませんでした。\n\n' + error);
      }
    }, 3000); // 3秒のデバウンス

    // コンポーネントがアンマウントされるか、依存配列の値が変更された場合にタイマーをクリア
    return () => clearTimeout(debounceSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMemoText]);

  return {
    observeTimeStamp,
  };
};
