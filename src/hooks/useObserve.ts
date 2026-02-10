import { useEffect, useCallback, useRef } from 'react';
import { get } from 'firebase/database';
import { useTreeManagement } from '@/hooks/useTreeManagement';
import { useAppStateManagement } from '@/hooks/useAppStateManagement';
import { useOfflineTree } from '@/hooks/useOfflineTree';
import { useError } from '@/hooks/useError';
import { useSync } from '@/hooks/useSync';
import { getDatabase, ref, onValue } from 'firebase/database';
import * as timerService from '@/services/timerService';
import * as dbService from '@/services/databaseService';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';
import { useSyncStateStore } from '@/store/syncStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { Preferences } from '@capacitor/preferences';
import * as idbService from '@/services/indexedDbService';
import { getClientId, hashData } from '@/utils/syncUtils';
import { mergeTreeItems } from '@/utils/mergeUtils';

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

    const isConnectedDb = useAppStateStore.getState().isConnectedDb;

    try {
      const itemsTreeId = useTreeStateStore.getState().itemsTreeId;
      if (currentTree && currentItems.length > 0 && itemsTreeId === currentTree) {
        if (isOffline) {
          await Preferences.set({
            key: `items_offline`,
            value: JSON.stringify(currentItems),
          });
        } else if (uid && !isConnectedDb) {
          await idbService.saveItemsToIdb(currentTree, currentItems);
          useSyncStateStore.getState().markItemsDirty(currentItems);
        } else if (uid) {
          await saveItems(currentItems, currentTree);
        }
      }

      if (currentQuickMemo) {
        if (isOffline) {
          await Preferences.set({
            key: `quick_memo_offline`,
            value: currentQuickMemo,
          });
        } else if (uid && !isConnectedDb) {
          await idbService.saveQuickMemoToIdb(currentQuickMemo);
          useSyncStateStore.getState().markMemoDirty(currentQuickMemo);
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

    const handleBeforeUnload = () => {
      saveImmediately();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
        const serverTimestamp = snapshot.val();
        const currentLocalTimestamp = useAppStateStore.getState().localTimestamp;
        if (!serverTimestamp || serverTimestamp <= currentLocalTimestamp) {
          return;
        }

        const remoteClientId = await dbService.loadLastWriteClientIdFromDb(uid);
        const localClientId = getClientId();

        if (remoteClientId === localClientId) {
          setLocalTimestamp(serverTimestamp);
          return;
        }

        const { setIsSyncing } = useSyncStateStore.getState();
        setIsSyncing(true);
        setIsLoading(true);

        try {
          setLocalTimestamp(serverTimestamp);
          await loadAndSetSettingsFromDb({ saveToIdb: true });

          const { dirty: memoDirty, baseHash: memoBaseHash } = useSyncStateStore.getState().memoSync;
          if (!memoDirty) {
            await loadAndSetQuickMemoFromDb({ saveToIdb: true });
          } else {
            const serverMemo = await dbService.loadQuickMemoFromDb(uid);
            const serverMemoHash = hashData(serverMemo ?? '');
            if (serverMemoHash === memoBaseHash) {
              const currentMemo = useAppStateStore.getState().quickMemoText;
              await dbService.saveQuickMemoToDb(uid, currentMemo);
              await idbService.saveQuickMemoToIdb(currentMemo);
              useSyncStateStore.getState().clearMemoDirty();
              useSyncStateStore.getState().setMemoServerHash(hashData(currentMemo));
            } else {
              const localMemoHash = hashData(useAppStateStore.getState().quickMemoText);
              if (serverMemoHash === localMemoHash) {
                useSyncStateStore.getState().clearMemoDirty();
                useSyncStateStore.getState().setMemoServerHash(serverMemoHash);
              } else {
                await loadAndSetQuickMemoFromDb({ saveToIdb: true });
              useSyncStateStore.getState().clearMemoDirty();
              }
            }
          }

          const newTreesList = await loadAndSetTreesListFromDb({ saveToIdb: true });
          if (!newTreesList) {
            return;
          }

          const currentTreeBeforeSync = useTreeStateStore.getState().currentTree;
          if (currentTreeBeforeSync && !newTreesList.some((t) => t.id === currentTreeBeforeSync)) {
            const currentItems = useTreeStateStore.getState().items;
            const currentTreeName = useTreeStateStore.getState().currentTreeName;
            if (currentItems.length > 0) {
              const shouldSave = await showDialog(
                `「${currentTreeName ?? 'このツリー'}」は別のデバイスで削除されました。ローカルコピーとして保存しますか？`,
                'Tree Deleted',
                true
              );
              if (shouldSave) {
                const uid = useAppStateStore.getState().uid;
                if (uid) {
                  const functions = (await import('firebase/functions')).getFunctions();
                  const createNewTree = (await import('firebase/functions')).httpsCallable(functions, 'createNewTree');
                  const result = await createNewTree({
                    items: currentItems.map((item) => ({
                      id: item.id.toString(),
                      children: item.children,
                      value: item.value,
                      collapsed: item.collapsed,
                      done: item.done,
                    })),
                    name: `${currentTreeName ?? 'ツリー'} (コピー)`,
                    members: { [uid]: true },
                  });
                  const newTreeId = result.data as string;
                  if (newTreeId) {
                    await copyTreeDataToIdbFromDb(newTreeId);
                    const updatedList = [...newTreesList, { id: newTreeId, name: `${currentTreeName ?? 'ツリー'} (コピー)` }];
                    useTreeStateStore.getState().setTreesList(updatedList);
                    await idbService.saveTreesListToIdb(updatedList);
                    useTreeStateStore.getState().setCurrentTree(newTreeId);
                    await loadAndSetCurrentTreeDataFromIdb(newTreeId);
                  }
                }
              }
            }
            if (!useTreeStateStore.getState().currentTree || useTreeStateStore.getState().currentTree === currentTreeBeforeSync) {
              useTreeStateStore.getState().setCurrentTree(null);
              useTreeStateStore.getState().setCurrentTreeName(null);
              useTreeStateStore.getState().setCurrentTreeMembers(null);
              setItems([]);
              useTreeStateStore.getState().setItemsTreeId(null);
            }
            useSyncStateStore.getState().setIsSyncing(false);
            setIsLoading(false);
            return;
          }

          const { dirty: itemsDirty, baseHash: itemsBaseHash } = useSyncStateStore.getState().itemsSync;

          const treeIds = newTreesList.map((tree) => tree.id);
          let treeUpdateCount = 0;
          for (const treeId of treeIds) {
            const treeTimestampRef = ref(getDatabase(), `trees/${treeId}/timestamp`);
            const treeSnapshot = await get(treeTimestampRef);
            if (treeSnapshot.exists()) {
              const data = treeSnapshot.val();
              if (data > currentLocalTimestamp) {
                if (treeId === currentTreeBeforeSync && itemsDirty) {
                  const serverItems = await dbService.loadItemsFromDb(treeId);
                  const serverItemsHash = hashData(serverItems);

                  if (serverItemsHash === itemsBaseHash) {
                    const currentItems = useTreeStateStore.getState().items;
                    await dbService.saveItemsDb(treeId, currentItems);
                    await idbService.saveItemsToIdb(treeId, currentItems);
                    useSyncStateStore.getState().clearItemsDirty();
                    useSyncStateStore.getState().setItemsServerHash(hashData(currentItems));
                  } else {
                    const localItemsHash = hashData(useTreeStateStore.getState().items);
                    if (serverItemsHash === localItemsHash) {
                      useSyncStateStore.getState().clearItemsDirty();
                      useSyncStateStore.getState().setItemsServerHash(serverItemsHash);
                    } else {
                      const baseSnapshot = useSyncStateStore.getState().itemsSync.baseSnapshot;
                      if (baseSnapshot && serverItems) {
                        const localItems = useTreeStateStore.getState().items;
                        const mergeResult = mergeTreeItems(baseSnapshot, localItems, serverItems);
                        setItems(mergeResult.merged);
                        await dbService.saveItemsDb(treeId, mergeResult.merged);
                        await idbService.saveItemsToIdb(treeId, mergeResult.merged);
                        useSyncStateStore.getState().clearItemsDirty();
                        useSyncStateStore.getState().setItemsServerHash(hashData(mergeResult.merged));
                      } else {
                        await copyTreeDataToIdbFromDb(treeId);
                        useSyncStateStore.getState().clearItemsDirty();
                      }
                    }
                  }
                } else {
                  await copyTreeDataToIdbFromDb(treeId);
                }
                treeUpdateCount++;
              }
            }
          }

          if (treeUpdateCount === 0) {
            const timestampV2Ref = ref(getDatabase(), `users/${uid}/timestampV2`);
            const v2Snapshot = await get(timestampV2Ref);
            if (v2Snapshot.exists()) {
              const data = v2Snapshot.val();
              if (data !== serverTimestamp) {
                console.log('サーバータイムスタンプのV1とV2に差異があるため、同期し直します。');
                await syncDb();
              }
            }
          }

          const currentTreeAfterSync = useTreeStateStore.getState().currentTree;
          const itemsTreeIdAfterSync = useTreeStateStore.getState().itemsTreeId;
          if (currentTreeAfterSync && !itemsDirty && itemsTreeIdAfterSync === currentTreeAfterSync) {
            setPrevCurrentTree(null);
            await loadAndSetCurrentTreeDataFromIdb(currentTreeAfterSync);
          }
        } finally {
          useSyncStateStore.getState().setIsSyncing(false);
          setIsLoading(false);
        }
      });

      // Firebaseの接続状態を監視
      const connectedRef = ref(getDatabase(), '.info/connected');
      const unsubscribeDbConnectionChecker = onValue(connectedRef, (snap) => {
        const setIsConnectedDb = useAppStateStore.getState().setIsConnectedDb;
        setIsConnectedDb(snap.val() === true);
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
    if ((!uid && !isOffline) || !currentTree) {
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
      useSyncStateStore.getState().resetAllSync();
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
          if (useSyncStateStore.getState().isSyncing) {
            return;
          }

          const itemsTreeId = useTreeStateStore.getState().itemsTreeId;
          const latestCurrentTree = useTreeStateStore.getState().currentTree;
          if (!itemsTreeId || itemsTreeId !== latestCurrentTree) {
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
          } else if (!isConnectedDb) {
            const asyncFunc = async () => {
              await idbService.saveItemsToIdb(targetTree, items);
              useSyncStateStore.getState().markItemsDirty(items);
            };
            asyncFunc();
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

    if ((!uid && !isOffline) || !quickMemoText) {
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
        if (useSyncStateStore.getState().isSyncing) {
          return;
        }

        if (isOffline) {
          Preferences.set({
            key: `quick_memo_offline`,
            value: quickMemoText,
          });
        } else if (!isConnectedDb) {
          const asyncFunc = async () => {
            await idbService.saveQuickMemoToIdb(quickMemoText);
            useSyncStateStore.getState().markMemoDirty(quickMemoText);
          };
          asyncFunc();
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
