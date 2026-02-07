import { useEffect, useCallback, useRef } from 'react';
import { get } from 'firebase/database';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { useAppStateManagement } from '@/hooks/useAppStateManagement';
import { useOfflineTree } from '@/hooks/useOfflineTree';
import { useError } from '@/hooks/useError';
import { useSync } from '@/hooks/useSync';
import { getDatabase, ref, onValue } from 'firebase/database';
import * as timerService from '@/services/timerService';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { Preferences } from '@capacitor/preferences';

export const useObserve = () => {
  const items = useTreeStateStore((state) => state.items);
  const quickMemoText = useAppStateStore((state) => state.quickMemoText);
  const setLocalTimestamp = useAppStateStore((state) => state.setLocalTimestamp);
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const setIsLoadedMemoFromDb = useAppStateStore((state) => state.setIsLoadedMemoFromDb);
  const setItems = useTreeStateStore((state) => state.setItems);
  const setPrevItems = useTreeStateStore((state) => state.setPrevItems);
  const setPrevCurrentTree = useTreeStateStore((state) => state.setPrevCurrentTree);

  const showDialog = useDialogStore((state) => state.showDialog);

  const { loadAndSetCurrentTreeDataFromIdb, saveItems, loadAndSetTreesListFromDb, loadAndSetTreesListFromIdb } = useTreeManagement();
  const { loadAndSyncOfflineTree } = useOfflineTree();
  const { syncDb, checkAndSyncDb, copyTreeDataToIdbFromDb, loadAndSetLocalTimeStamp } = useSync();
  const { loadAndSetSettingsFromDb, loadAndSetQuickMemoFromDb, loadAndSetQuickMemoFromIdb, saveQuickMemo, loadAppSettingsFromIdb } = useAppStateManagement();
  const { handleError } = useError();

  // デバウンスタイマーの参照を保持
  const itemsDebounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const memoDebounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);


  // バックグラウンド移行時の即時保存処理
  const saveImmediately = useCallback(async () => {
    const currentTree = useTreeStateStore.getState().currentTree;
    const isOffline = useAppStateStore.getState().isOffline;
    const uid = useAppStateStore.getState().uid;
    const currentItems = useTreeStateStore.getState().items;
    const currentQuickMemo = useAppStateStore.getState().quickMemoText;

    // デバウンスタイマーをクリア
    if (itemsDebounceTimer.current) {
      clearTimeout(itemsDebounceTimer.current);
    }
    if (memoDebounceTimer.current) {
      clearTimeout(memoDebounceTimer.current);
    }

    try {
      const itemsTreeId = useTreeStateStore.getState().itemsTreeId;
      if (currentTree && currentItems.length > 0 && (itemsTreeId === null || itemsTreeId === currentTree)) {
        if (isOffline) {
          await Preferences.set({
            key: `items_offline`,
            value: JSON.stringify(currentItems),
          });
        } else if (uid) {
          await saveItems(currentItems, currentTree);
        }
      }

      // クイックメモの保存
      if (currentQuickMemo) {
        if (isOffline) {
          await Preferences.set({
            key: `quick_memo_offline`,
            value: currentQuickMemo,
          });
        } else if (uid) {
          await saveQuickMemo(currentQuickMemo);
        }
      }
    } catch (error) {
      handleError('バックグラウンド移行時のデータ保存に失敗しました。\n\n' + error);
    }
  }, [saveItems, saveQuickMemo, handleError]);

  // アプリケーションの状態変更を監視
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveImmediately();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveImmediately]);

  // サーバのタイムスタンプを監視 ------------------------------------------------
  const observeTimeStamp = useCallback(
    async (uid: string) => {
      setIsLoading(true);
      await loadAndSetLocalTimeStamp();
      await checkAndSyncDb();
      await loadAppSettingsFromIdb();
      await loadAndSetTreesListFromIdb();
      await loadAndSetQuickMemoFromIdb();
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
          await loadAndSetSettingsFromDb({ saveToIdb: true });
          await loadAndSetQuickMemoFromDb({ saveToIdb: true });
          const newTreesList = await loadAndSetTreesListFromDb({ saveToIdb: true });
          if (!newTreesList) {
            return;
          }
          // 各ツリーのタイムスタンプをチェックし、最新のツリーをコピー
          const treeIds = newTreesList.map((tree) => tree.id);
          let treeUpdateCount = 0;
          for (const treeId of treeIds) {
            setIsLoading(true);
            const treeTimestampRef = ref(getDatabase(), `trees/${treeId}/timestamp`);
            await get(treeTimestampRef).then(async (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.val();
                if (data > currentLocalTimestamp) {
                  await copyTreeDataToIdbFromDb(treeId);
                  treeUpdateCount++;
                }
              }
            });
          }
          // サーバータイムスタンプのV1とV2に差異がある場合、同期し直す
          if (treeUpdateCount == 0) {
            setIsLoading(true);
            const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
            await get(timestampV2Ref).then(async (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.val();
                if (data !== serverTimestamp) {
                  console.log('サーバータイムスタンプのV1とV2に差異があるため、同期し直します。');
                  await syncDb();
                }
              }
            });
          }
          const currentTreeAfterSync = useTreeStateStore.getState().currentTree;
          if (currentTreeAfterSync) {
            setIsLoading(true);
            setPrevCurrentTree(null);
            await loadAndSetCurrentTreeDataFromIdb(currentTreeAfterSync);
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
    },
    [
      loadAndSetLocalTimeStamp,
      checkAndSyncDb,
      syncDb,
      loadAndSetSettingsFromDb,
      loadAndSetQuickMemoFromDb,
      loadAndSetQuickMemoFromIdb,
      loadAndSetTreesListFromDb,
      loadAndSetTreesListFromIdb,
      copyTreeDataToIdbFromDb,
      loadAppSettingsFromIdb,
      loadAndSetCurrentTreeDataFromIdb,
      loadAndSyncOfflineTree,
      setIsLoading,
      setLocalTimestamp,
      setPrevCurrentTree,
    ]
  );

  // ローカルitemsの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    const currentTree = useTreeStateStore.getState().currentTree;
    const currentTreeName = useTreeStateStore.getState().currentTreeName;
    const isOffline = useAppStateStore.getState().isOffline;
    const uid = useAppStateStore.getState().uid;
    const prevItems = useTreeStateStore.getState().prevItems;
    const prevCurrentTree = useTreeStateStore.getState().prevCurrentTree;
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

    if (currentTree !== prevCurrentTree) {
      if (prevItems.length > 0) {
        const asyncFunc = async () => {
          if (prevCurrentTree) {
            await saveItems(prevItems, prevCurrentTree);
          }
        };
        asyncFunc();
      }
      setPrevCurrentTree(currentTree);
      setPrevItems([]);
    } else {
      setPrevItems(items);
      const targetTree = currentTree;

      if (itemsDebounceTimer.current) {
        clearTimeout(itemsDebounceTimer.current);
      }

      itemsDebounceTimer.current = setTimeout(() => {
        try {
          // レースコンディション防止: 保存時にitemsが属するツリーとcurrentTreeの一致を確認
          const itemsTreeId = useTreeStateStore.getState().itemsTreeId;
          const latestCurrentTree = useTreeStateStore.getState().currentTree;
          if (itemsTreeId !== null && itemsTreeId !== latestCurrentTree) {
            return;
          }
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
              await saveItems(items, targetTree);
            };
            asyncFunc();
          }
          setPrevItems([]);
        } catch (error) {
          handleError('ツリー内容の変更をデータベースに保存できませんでした。\n\n' + error);
        }
      }, 5000);
    }

    return () => {
      if (itemsDebounceTimer.current) {
        clearTimeout(itemsDebounceTimer.current);
      }
      clearInterval(intervalId);
    };
  }, [items, handleError, saveItems, setItems, setPrevCurrentTree, setPrevItems, setIsLoading, setLocalTimestamp, showDialog]);

  // ローカルのクイックメモの変更を監視し、データベースに保存 ---------------------------------------------------------------------------
  useEffect(() => {
    const isConnectedDb = useAppStateStore.getState().isConnectedDb;
    const isOffline = useAppStateStore.getState().isOffline;
    const uid = useAppStateStore.getState().uid;
    const isLoadedMemoFromDb = useAppStateStore.getState().isLoadedMemoFromDb;

    if ((!uid && !isOffline) || (!isConnectedDb && !isOffline) || !quickMemoText) {
      return;
    }
    if (isLoadedMemoFromDb) {
      setIsLoadedMemoFromDb(false);
      return;
    }

    if (memoDebounceTimer.current) {
      clearTimeout(memoDebounceTimer.current);
    }

    memoDebounceTimer.current = setTimeout(() => {
      try {
        if (isOffline) {
          Preferences.set({
            key: `quick_memo_offline`,
            value: quickMemoText,
          });
        } else {
          const asyncFunc = async () => {
            await saveQuickMemo(quickMemoText);
          };
          asyncFunc();
        }
      } catch (error) {
        handleError('クイックメモの変更をデータベースに保存できませんでした。\n\n' + error);
      }
    }, 3000);

    return () => {
      if (memoDebounceTimer.current) {
        clearTimeout(memoDebounceTimer.current);
      }
    };
  }, [quickMemoText, handleError, saveQuickMemo, setIsLoadedMemoFromDb, setIsLoading, showDialog]);

  return {
    observeTimeStamp,
  };
};
